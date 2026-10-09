import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import type Pusher from 'pusher-js';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { ApiService, apiUrl } from '../http/api.service';
import { Items } from '../models/api.model';
import { Notification, RealtimeConfig } from './notification.model';

/**
 * In-app inbox shared by the top-bar bell and the Notifications page.
 * Pusher (private per-user channel) only signals "refetch"; the API list stays
 * the source of truth. Falls back to polling.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private pusher: Pusher | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;

  readonly items = signal<Notification[]>([]);
  readonly loading = signal(false);
  readonly live = signal(false);
  readonly unread = computed(() => this.items().filter((n) => !n.isRead).length);

  constructor() {
    this.session.onReset(() => this.stop());
  }

  async start(): Promise<void> {
    this.stop();
    await this.load();
    if (environment.realtime && (await this.connect())) return;
    this.poll = setInterval(() => void this.load(), environment.pollMs);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { items } = await firstValueFrom(this.api.get<Items<Notification>>('/api/notifications'));
      this.items.set(items);
    } catch {
      // Bell keeps the last known list; the inbox page shows its own error state.
    } finally {
      this.loading.set(false);
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

  private async connect(): Promise<boolean> {
    try {
      const cfg = await firstValueFrom(this.api.get<RealtimeConfig>('/api/realtime/config'));
      if (!cfg.enabled || !cfg.key || !cfg.cluster) return false;
      const { default: PusherJs } = await import('pusher-js');
      const pusher = new PusherJs(cfg.key, {
        cluster: cfg.cluster,
        channelAuthorization: {
          endpoint: apiUrl('/api/realtime/auth'),
          transport: 'ajax',
          headersProvider: () => ({ Authorization: `Bearer ${this.session.token() ?? ''}` }),
        },
      });
      pusher.subscribe(cfg.userChannel).bind('notification.created', () => void this.load());
      pusher.connection.bind('state_change', ({ current }: { current: string }) => this.live.set(current === 'connected'));
      this.pusher = pusher;
      return true;
    } catch {
      return false;
    }
  }

  private stop(): void {
    this.pusher?.disconnect();
    this.pusher = null;
    this.live.set(false);
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.items.set([]);
  }
}
