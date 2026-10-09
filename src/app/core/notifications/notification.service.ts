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
 * the source of truth. Polling is always armed and only skips while Pusher is
 * actually connected, so a failed connect, auth error or drop falls back to it.
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
    this.poll = setInterval(() => {
      if (!this.live()) void this.load();
    }, environment.pollMs);
    await this.load();
    if (environment.realtime) await this.connect();
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

  /** Best-effort; any failure simply leaves polling in charge. */
  private async connect(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.api.get<RealtimeConfig>('/api/realtime/config'));
      if (!cfg.enabled || !cfg.key || !cfg.cluster) return;
      const { default: PusherJs } = await import('pusher-js');
      const pusher = new PusherJs(cfg.key, {
        cluster: cfg.cluster,
        channelAuthorization: {
          endpoint: apiUrl('/api/realtime/auth'),
          transport: 'ajax',
          headersProvider: () => ({ Authorization: `Bearer ${this.session.token() ?? ''}` }),
        },
      });
      const channel = pusher.subscribe(cfg.userChannel);
      channel.bind('notification.created', () => void this.load());
      // Live only once the private channel is authorized; auth failure or a drop hands back to polling.
      channel.bind('pusher:subscription_succeeded', () => this.setLive(pusher.connection.state === 'connected'));
      channel.bind('pusher:subscription_error', () => this.live.set(false));
      pusher.connection.bind('state_change', ({ current }: { current: string }) => this.setLive(current === 'connected' && channel.subscribed));
      this.pusher = pusher;
    } catch {
      this.live.set(false);
    }
  }

  /** Re-read on every (re)connect to catch events missed while offline. */
  private setLive(live: boolean): void {
    if (live && !this.live()) void this.load();
    this.live.set(live);
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
