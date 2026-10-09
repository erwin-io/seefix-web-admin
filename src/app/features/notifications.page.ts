import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { Notification } from '../core/models';
import { Notifications } from '../core/notifications';
import { Ui } from '../core/ui';
import { SHARED, entityLink } from '../shared/ui';

@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, ...SHARED],
  styles: `
    .list { padding: 0; }
    .item { display: flex; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--sf-border); cursor: pointer; }
    .item:last-child { border-bottom: 0; }
    .item:hover { background: #f8faff; }
    .dot { width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; flex: none; background: transparent; }
    .unread .dot { background: var(--sf-accent); }
    .unread strong { font-weight: 700; }
    strong { font-weight: 500; }
    p { margin: 2px 0; color: var(--sf-muted); }
    small { color: var(--sf-muted); }
  `,
  template: `
    <div class="page-head">
      <div>
        <h1>Notifications</h1>
        <p>{{ inbox.unread() }} unread{{ inbox.live() ? ' · live' : '' }}</p>
      </div>
      <div class="actions">
        <mat-button-toggle-group [value]="filter()" (change)="filter.set($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="all">All</mat-button-toggle>
          <mat-button-toggle value="unread">Unread</mat-button-toggle>
        </mat-button-toggle-group>
        <button mat-stroked-button (click)="inbox.load()"><mat-icon>refresh</mat-icon>Refresh</button>
        <button mat-flat-button [disabled]="!inbox.unread()" (click)="readAll()">Mark all read</button>
      </div>
    </div>
    <div class="card list">
      <app-state [loading]="inbox.loading() && !inbox.items().length" [empty]="shown().length ? null : 'No notifications'" icon="notifications_none" />
      @for (n of shown(); track n.id) {
        <div class="item" [class.unread]="!n.isRead" (click)="open(n)" (keydown.enter)="open(n)" tabindex="0" role="link">
          <span class="dot"></span>
          <div>
            <strong>{{ n.title }}</strong>
            <p>{{ n.message }}</p>
            <small>{{ n.createdAt | date: 'medium' }} · {{ n.type | humanize }}</small>
          </div>
        </div>
      }
    </div>
  `,
})
export class NotificationsPage {
  readonly inbox = inject(Notifications);
  private readonly router = inject(Router);
  private readonly ui = inject(Ui);
  readonly filter = signal<'all' | 'unread'>('all');
  readonly shown = computed(() => (this.filter() === 'unread' ? this.inbox.items().filter((n) => !n.isRead) : this.inbox.items()));

  constructor() {
    void this.inbox.load();
  }

  async open(n: Notification): Promise<void> {
    await this.inbox.markRead(n).catch((e) => this.ui.error(e));
    const link = entityLink(n.entityType, n.entityId, n.payload);
    if (link) void this.router.navigateByUrl(link);
  }

  readAll(): void {
    this.inbox.markAllRead().catch((e) => this.ui.error(e));
  }
}
