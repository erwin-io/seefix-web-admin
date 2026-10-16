import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SessionService } from '@app/core/auth/session.service';
import { toAppError } from '@app/core/http/app-error';
import { STAFF_ROLES } from '@app/core/models/user.model';
import { AssistantApi } from './assistant.api';
import { explain } from './assistant.explain';
import { AskResponse, QueueItem, RecordContext, RecordType, ToolCatalog } from './assistant.model';

export type PanelView = 'closed' | 'open' | 'minimized';
export type PanelTab = 'chat' | 'record' | 'reminders';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  status: 'pending' | 'done' | 'error';
  /** For the assistant's reply: what it answers (used by retry). */
  question?: string;
  context?: RecordContext | null;
  response?: AskResponse;
}

/** At most this many questions in flight at once (each gets its own reply slot, in order). */
export const MAX_PENDING = 3;
/** Queue hints are refreshed on open when older than this. */
export const HINTS_TTL_MS = 60_000;

const RECORD_ROUTES: [RegExp, RecordType][] = [
  [/^\/reports\/([0-9a-f-]{36})(?:[/?#]|$)/i, 'report'],
  [/^\/work-orders\/([0-9a-f-]{36})(?:[/?#]|$)/i, 'work_order'],
  [/^\/procurement\/handoffs\/([0-9a-f-]{36})(?:[/?#]|$)/i, 'handoff'],
];
/** Record detail paths the API hands out in facts and queue items; the route guard + detail API still decide access. */
const RECORD_PATH = /^\/(reports|work-orders|procurement\/handoffs)\/[0-9a-f-]{36}$/i;

export function recordContextOf(url: string): RecordContext | null {
  for (const [re, type] of RECORD_ROUTES) {
    const m = re.exec(url);
    if (m) return { type, id: m[1].toLowerCase() };
  }
  return null;
}

/**
 * The floating assistant's state for the signed-in user. Lives in memory only (never storage), survives
 * open/minimize/close and in-app navigation, and is purged on sign-out or account switch (SessionService.onReset,
 * the same hook CacheSyncService and the inbox use). Responses from a previous session are dropped.
 */
@Injectable({ providedIn: 'root' })
export class AssistantStore {
  private readonly api = inject(AssistantApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly win = inject(DOCUMENT).defaultView;

  readonly view = signal<PanelView>('closed');
  readonly tab = signal<PanelTab>('chat');
  readonly catalog = signal<ToolCatalog | null>(null);
  /** `unavailable` = the API has no assistant for this user (403/404): the launcher hides. */
  readonly availability = signal<'unknown' | 'ready' | 'unavailable' | 'error'>('unknown');
  readonly catalogError = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly hints = signal<QueueItem[]>([]);
  readonly hintsError = signal<string | null>(null);
  readonly online = signal(this.win?.navigator.onLine ?? true);
  readonly context = signal<RecordContext | null>(recordContextOf(this.router.url));
  /** Whether questions include the open record as context. */
  readonly useContext = signal(true);
  /** Unsaved draft text per record, kept while the panel is closed. */
  readonly draftText = signal<Record<string, string>>({});

  readonly pending = computed(() => this.messages().filter((m) => m.status === 'pending').length);
  readonly visible = computed(
    () => this.session.has(...STAFF_ROLES) && this.availability() !== 'unavailable',
  );
  readonly canReassess = computed(
    () => !!this.catalog()?.actions.allowed.includes('request_reassessment'),
  );

  private run = 0;
  private seq = 0;
  private owner: string | null = null;
  private catalogLoad: Promise<void> | null = null;
  private hintsAt = 0;

  constructor() {
    this.session.onReset(() => this.purge());
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => this.context.set(recordContextOf(e.urlAfterRedirects)));
    this.win?.addEventListener('online', () => this.online.set(true));
    this.win?.addEventListener('offline', () => this.online.set(false));
  }

  /** Called when the launcher mounts: loads the role's tool catalog and queue hints once per session. */
  init(): Promise<void> {
    this.guardOwner();
    if (!this.session.has(...STAFF_ROLES)) return Promise.resolve();
    return (this.catalogLoad ??= this.loadCatalog());
  }

  open(): void {
    this.guardOwner();
    this.view.set('open');
    void this.init(); // no request once loaded; retries after an outage
    if (this.availability() === 'ready' && Date.now() - this.hintsAt > HINTS_TTL_MS)
      void this.loadHints();
  }

  minimize(): void {
    this.view.set('minimized');
  }

  close(): void {
    this.view.set('closed');
  }

  /** Clears the conversation only (not reminders or drafts, which live on the server). */
  clear(): void {
    this.messages.set([]);
  }

  /** Asks a question. Returns false when nothing was sent (empty, too long or too many in flight). */
  send(raw: string): boolean {
    this.guardOwner();
    const question = raw.trim().slice(0, 1000);
    if (!question || this.pending() >= MAX_PENDING) return false;
    const context = this.useContext() ? this.context() : null;
    const reply: ChatMessage = {
      id: ++this.seq,
      role: 'assistant',
      text: '',
      status: 'pending',
      question,
      context,
    };
    this.messages.update((list) => [
      ...list,
      { id: ++this.seq, role: 'user', text: question, status: 'done' },
      reply,
    ]);
    void this.answer(reply.id, question, context);
    return true;
  }

  retry(id: number): void {
    const msg = this.messages().find((m) => m.id === id);
    if (!msg || msg.status !== 'error' || !msg.question || this.pending() >= MAX_PENDING) return;
    this.patch(id, { status: 'pending', text: '' });
    void this.answer(id, msg.question, msg.context ?? null);
  }

  async loadHints(): Promise<void> {
    const run = this.run;
    this.hintsAt = Date.now();
    try {
      const items = await this.api.actionQueue(5);
      if (run !== this.run) return;
      this.hints.set(items.filter((i) => this.allowedPath(i.route)));
      this.hintsError.set(null);
    } catch (e) {
      if (run !== this.run) return;
      this.hintsAt = 0;
      this.hintsError.set(explain(e));
    }
  }

  /**
   * Only paths the API returned AND that are web-admin pages: the role's navigation list, or a record detail
   * page (whose route guard and detail API still check access). Anything else is never a link.
   */
  allowedPath(path: unknown): path is string {
    if (typeof path !== 'string') return false;
    return !!this.catalog()?.navigation.some((n) => n.path === path) || RECORD_PATH.test(path);
  }

  go(path: string): void {
    if (!this.allowedPath(path)) return;
    void this.router.navigateByUrl(path);
    if (this.win && this.win.innerWidth < 600) this.minimize();
  }

  setDraft(entityId: string, text: string): void {
    this.draftText.update((d) => ({ ...d, [entityId]: text }));
  }

  /** Sign-out / account switch: nothing of this user's survives in memory. */
  purge(): void {
    this.run++;
    this.view.set('closed');
    this.tab.set('chat');
    this.catalog.set(null);
    this.availability.set('unknown');
    this.catalogError.set(null);
    this.messages.set([]);
    this.hints.set([]);
    this.hintsError.set(null);
    this.useContext.set(true);
    this.draftText.set({});
    this.catalogLoad = null;
    this.hintsAt = 0;
    this.owner = null;
  }

  /** Belt and braces: a different user id than the one this state belongs to purges it. */
  private guardOwner(): void {
    const id = this.session.user()?.id ?? null;
    if (this.owner && this.owner !== id) this.purge();
    this.owner = id;
  }

  private async loadCatalog(): Promise<void> {
    const run = this.run;
    try {
      const catalog = await this.api.tools();
      if (run !== this.run) return;
      this.catalog.set(catalog);
      this.availability.set('ready');
      this.catalogError.set(null);
      void this.loadHints();
    } catch (e) {
      if (run !== this.run) return;
      const err = toAppError(e);
      // 403 (role) or 404 (API without the assistant): no launcher. Anything else is retryable.
      this.availability.set(err.status === 403 || err.status === 404 ? 'unavailable' : 'error');
      this.catalogError.set(explain(err));
      this.catalogLoad = null;
    }
  }

  private async answer(id: number, question: string, context: RecordContext | null): Promise<void> {
    const run = this.run;
    try {
      const res = await this.api.ask(question, context);
      if (run !== this.run) return;
      const response = {
        ...res,
        navigation: (res.navigation ?? []).filter((n) => this.allowedPath(n.path)),
      };
      this.patch(id, { status: 'done', text: res.answer, response });
      this.announcer.announce(`SEEFIX Assistant: ${res.answer.slice(0, 300)}`, 'polite');
    } catch (e) {
      if (run !== this.run) return;
      const text = explain(e);
      this.patch(id, { status: 'error', text });
      this.announcer.announce(`SEEFIX Assistant could not answer. ${text}`, 'polite');
    }
  }

  private patch(id: number, change: Partial<ChatMessage>): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, ...change } : m)));
  }
}
