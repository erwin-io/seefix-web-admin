import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { UiService } from '@app/shared/services/ui.service';
import { AssistantApi, newKey } from './assistant.api';
import { previewThenConfirm } from './assistant.confirm';
import { REMINDER_STATUS, explain } from './assistant.explain';
import { Reminder, ReminderStatus } from './assistant.model';
import { AssistantStore } from './assistant.store';

const CANCELLABLE: ReminderStatus[] = ['SCHEDULED', 'PROCESSING', 'FAILED'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Every 15 minutes, labelled in the viewer's locale ("9:30 AM"). */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const value = `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`;
  const label = new Date(2000, 0, 1, Math.floor(i / 4), (i % 4) * 15).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { value, label };
});

/** The picked local date + "HH:mm" as the API's local `YYYY-MM-DDTHH:mm` (no time zone conversion here). */
export function localDueAt(date: Date, time: string): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The browser's IANA zone; the API reads the local `dueAt` in it and stores UTC. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Shows a stored UTC instant in the zone the reminder was created in. */
export function formatDue(r: Pick<Reminder, 'dueAt' | 'timeZone'>): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: r.timeZone,
      timeZoneName: 'short',
    }).format(new Date(r.dueAt));
  } catch {
    return new Date(r.dueAt).toLocaleString();
  }
}

/** Persistent reminders (seefix-worker delivers them as in-app notifications to the recipient). Self-reminders only. */
@Component({
  selector: 'app-assistant-reminders',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './assistant-reminders.component.html',
  styleUrl: './assistant-reminders.component.scss',
})
export class AssistantRemindersComponent {
  readonly store = inject(AssistantStore);
  private readonly api = inject(AssistantApi);
  private readonly ui = inject(UiService);

  readonly statusLabel = REMINDER_STATUS;
  readonly formatDue = formatDue;
  readonly timeZone = localTimeZone();
  readonly times = TIME_OPTIONS;
  /** The calendar starts at today (a past time is refused anyway). */
  readonly today = startOfToday();
  readonly scope = signal<'received' | 'created'>('received');
  readonly items = signal<Reminder[] | null>(null);
  readonly error = signal<string | null>(null);
  readonly problem = signal<string | null>(null);
  readonly done = signal<string | null>(null);
  readonly busy = signal(false);

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(250)],
    }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    dueDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    dueTime: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    attach: new FormControl(true, { nonNullable: true }),
  });

  private run = 0;
  private key: string | null = null;

  constructor() {
    this.load();
    // Any edit after a failed attempt is a new request.
    this.form.valueChanges.subscribe(() => (this.key = null));
    inject(DestroyRef).onDestroy(() => this.run++);
  }

  cancellable(r: Reminder): boolean {
    return CANCELLABLE.includes(r.status);
  }

  setScope(scope: 'received' | 'created'): void {
    this.scope.set(scope);
    this.load();
  }

  load(): void {
    const run = ++this.run;
    this.items.set(null);
    this.error.set(null);
    this.api.reminders(this.scope()).then(
      (items) => run === this.run && this.items.set(items),
      (e) => run === this.run && this.error.set(explain(e)),
    );
  }

  async create(): Promise<void> {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || this.busy()) return;
    const dueAt = localDueAt(v.dueDate!, v.dueTime);
    if (!(new Date(dueAt).getTime() > Date.now())) {
      this.problem.set('Pick a time in the future.');
      return;
    }
    const ctx = this.store.context();
    const params = {
      title: v.title.trim(),
      ...(v.message.trim() ? { message: v.message.trim() } : {}),
      dueAt, // local YYYY-MM-DDTHH:mm, read by the API in timeZone (DST handled server-side)
      timeZone: this.timeZone,
      ...(ctx && v.attach ? { entity: { type: ctx.type, id: ctx.id } } : {}),
    };
    await this.write(async () => {
      const ok = await previewThenConfirm(this.ui, this.api.createReminder(params), {
        title: 'Create reminder?',
        confirm: 'Create reminder',
      });
      if (!ok) return null;
      this.key ??= newKey();
      await this.api.createReminder(params, { key: this.key });
      this.form.reset({ title: '', message: '', dueDate: null, dueTime: '', attach: true });
      this.key = null;
      this.scope.set('created');
      return 'Reminder created. You will get an in-app notification when it is due.';
    });
  }

  async cancel(r: Reminder): Promise<void> {
    await this.write(async () => {
      const ok = await previewThenConfirm(this.ui, this.api.cancelReminder(r.id), {
        title: 'Cancel reminder?',
        confirm: 'Cancel reminder',
        danger: true,
      });
      if (!ok) return null;
      await this.api.cancelReminder(r.id, true);
      return 'Reminder cancelled.';
    });
  }

  private async write(fn: () => Promise<string | null>): Promise<void> {
    const run = this.run;
    this.busy.set(true);
    this.problem.set(null);
    this.done.set(null);
    try {
      const msg = await fn();
      if (run !== this.run || msg === null) return;
      this.done.set(msg);
      this.load();
    } catch (e) {
      if (run === this.run) this.problem.set(explain(e));
    } finally {
      this.busy.set(false);
    }
  }
}
