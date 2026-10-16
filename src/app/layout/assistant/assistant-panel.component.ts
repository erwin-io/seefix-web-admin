import { A11yModule } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { map } from 'rxjs';
import { SessionService } from '@app/core/auth/session.service';
import { ROLE_LABEL } from '@app/core/models/user.model';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';
import { AssistantRecordComponent } from './assistant-record.component';
import { AssistantRemindersComponent } from './assistant-reminders.component';
import { DRAFT_KIND, RecordType } from './assistant.model';
import { AssistantStore, ChatMessage, MAX_PENDING, PanelTab } from './assistant.store';

const TABS: PanelTab[] = ['chat', 'record', 'reminders'];
const RECORD_NAME: Record<RecordType, string> = {
  report: 'this report',
  work_order: 'this work order',
  handoff: 'this handoff',
};

export const SUGGESTIONS = [
  'What needs my attention today?',
  'Summarize my open work.',
  'Is anything overdue?',
];

/** The open assistant: a non-modal dialog (focus-trapped when it covers the screen on phones). */
@Component({
  selector: 'app-assistant-panel',
  imports: [
    A11yModule,
    DatePipe,
    FormsModule,
    HumanizePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    AssistantRecordComponent,
    AssistantRemindersComponent,
  ],
  templateUrl: './assistant-panel.component.html',
  styleUrl: './assistant-panel.component.scss',
})
export class AssistantPanelComponent {
  readonly store = inject(AssistantStore);
  private readonly session = inject(SessionService);
  readonly mobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 600px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('question');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  readonly suggestions = SUGGESTIONS;
  readonly maxPending = MAX_PENDING;
  readonly draft = signal('');
  readonly roleLabel = computed(() => ROLE_LABEL[this.session.role() ?? 'ADMIN']);
  readonly recordName = computed(() => {
    const ctx = this.store.context();
    return ctx ? RECORD_NAME[ctx.type] : null;
  });
  readonly tabIndex = computed(() => {
    const i = TABS.indexOf(this.store.tab());
    return i === 1 && !this.store.context() ? 0 : i;
  });
  readonly canDraft = computed(() => {
    const ctx = this.store.context();
    return !!ctx && this.session.has(...DRAFT_KIND[ctx.type].roles);
  });
  readonly full = computed(() => this.store.pending() >= MAX_PENDING);

  constructor() {
    afterNextRender(() => {
      this.input()?.nativeElement.focus();
      this.scrollToEnd();
    });
  }

  selectTab(index: number): void {
    this.store.tab.set(TABS[index] ?? 'chat');
  }

  submit(): void {
    if (this.store.send(this.draft())) {
      this.draft.set('');
      setTimeout(() => this.scrollToEnd());
    }
  }

  ask(text: string): void {
    this.draft.set(text);
    this.submit();
  }

  /** Enter sends; Shift+Enter is a new line. */
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.submit();
    }
  }

  /** Draft-only: copies the answer into the record's private draft editor. Nothing is saved or submitted here. */
  useAsDraft(m: ChatMessage): void {
    const ctx = this.store.context();
    if (!ctx || !this.canDraft()) return;
    this.store.setDraft(ctx.id, m.text);
    this.store.tab.set('record');
  }

  private scrollToEnd(): void {
    const el = this.log()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
