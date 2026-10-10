import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import type Pusher from 'pusher-js';
import type { Options } from 'pusher-js';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { ApiService, apiUrl } from '../http/api.service';
import { Items } from '../models/api.model';
import { Notification, RealtimeConfig } from './notification.model';

/**
 * In-app inbox shared by the top-bar bell and the Notifications page.
 * Pusher (private per-user channel) only signals "refetch"; the API list stays
 * the source of truth. One timer re-reads REST every pollMs while not live, and
 * every reconcileMs while live: a connected socket does not prove the API is
 * still publishing (#11). Tradeoff: at most one extra list GET per user per
 * reconcileMs while live; reads never overlap.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private pusher: Pusher | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  /** Bumped by stop(): async work started under an older run must not touch state (issue #10). */
  private run = 0;
  private lastRead = 0;

  readonly items = signal<Notification[]>([]);
  readonly loading = signal(false);
  readonly live = signal(false);
  readonly unread = computed(() => this.items().filter((n) => !n.isRead).length);

  constructor() {
    this.session.onReset(() => this.stop());
  }

  async start(): Promise<void> {
    this.stop();
    this.poll = setInterval(() => this.tick(), environment.pollMs);
    const run = this.run;
    await this.load();
    if (environment.realtime && run === this.run) await this.connect(run);
  }

  async load(): Promise<void> {
    const run = this.run;
    this.lastRead = Date.now();
    this.loading.set(true);
    try {
      const { items } = await firstValueFrom(this.api.get<Items<Notification>>('/api/notifications'));
      if (run === this.run) this.items.set(items);
    } catch {
      // Bell keeps the last known list; the inbox page shows its own error state.
    } finally {
      if (run === this.run) this.loading.set(false);
    }
  }

  async markRead(n: Notification): Promise<void> {
    if (n.isRead) return;
    await firstValueFrom(this.api.post(`/api/notifications/${n.id}/read`));
    this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
  }

  async markAllRead(): Promise<void> {
    await firstValueFrom(this.api.post('/api/notifications/read-all'));
    this.items.update((list) => list.map((x) => ({ ...x, isRead: true })));
  }

  /** Best-effort; any failure simply leaves polling in charge. */
  private async connect(run: number): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.api.get<RealtimeConfig>('/api/realtime/config'));
      if (run !== this.run || !cfg.enabled || !cfg.key || !cfg.cluster) return;
      const pusher = await this.createPusher(cfg.key, {
        cluster: cfg.cluster,
        channelAuthorization: {
          endpoint: apiUrl('/api/realtime/auth'),
          transport: 'ajax',
          headersProvider: () => ({ Authorization: `Bearer ${this.session.token() ?? ''}` }),
        },
      });
      if (run !== this.run) return pusher.disconnect(); // logged out while pusher-js loaded
      const channel = pusher.subscribe(cfg.userChannel);
      // Callbacks already queued when this run ended must not touch the next session's state.
      const ifCurrent = <T>(fn: (arg: T) => void) => (arg: T) => run === this.run && fn(arg);
      channel.bind('notification.created', ifCurrent(() => void this.load()));
      // Live only once the private channel is authorized; auth failure or a drop hands back to polling.
      channel.bind('pusher:subscription_succeeded', ifCurrent(() => this.setLive(pusher.connection.state === 'connected')));
      channel.bind('pusher:subscription_error', ifCurrent(() => this.live.set(false)));
      pusher.connection.bind('state_change', ifCurrent(({ current }: { current: string }) => this.setLive(current === 'connected' && channel.subscribed)));
      this.pusher = pusher;
    } catch {
      if (run === this.run) this.live.set(false);
    }
  }

  /**
   * Timer read: due after pollMs (not live) or reconcileMs (live); half a poll of slack absorbs timer jitter.
   * No overlap: lastRead is stamped when a read starts and requests time out (requestTimeoutMs) before
   * half a poll elapses, so a read is never due while another is in flight (asserted in the spec).
   */
  private tick(): void {
    const due = this.live() ? environment.reconcileMs : environment.pollMs;
    if (Date.now() - this.lastRead >= due - environment.pollMs / 2) void this.load();
  }

  /** Test seam: the spec swaps in a fake client to drive the connection lifecycle. */
  protected async createPusher(key: string, options: Options): Promise<Pusher> {
    const { default: PusherJs } = await import('pusher-js');
    return new PusherJs(key, options);
  }

  /** Re-read on every (re)connect to catch events missed while offline. */
  private setLive(live: boolean): void {
    if (live && !this.live()) void this.load();
    this.live.set(live);
  }

  private stop(): void {
    this.run += 1;
    this.pusher?.disconnect();
    this.pusher = null;
    this.live.set(false);
    this.loading.set(false);
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.items.set([]);
  }
}
