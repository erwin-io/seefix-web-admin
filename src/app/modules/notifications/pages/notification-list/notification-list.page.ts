import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { Notification } from '@app/core/notifications/notification.model';
import { NotificationService } from '@app/core/notifications/notification.service';
import { UiService } from '@app/shared/services/ui.service';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { entityLink } from '@app/shared/utils/entity-link';

@Component({
  selector: 'app-notification-list-page',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, ...SHARED_IMPORTS],
  styleUrl: './notification-list.page.scss',
  templateUrl: './notification-list.page.html',
})
export class NotificationListPage {
  readonly inbox = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);
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
