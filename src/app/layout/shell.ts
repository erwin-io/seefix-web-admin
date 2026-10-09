import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map } from 'rxjs';
import { MAINTENANCE, PROCUREMENT_READERS, ROLE_LABEL, Role, WORK_ROLES } from '../core/models';
import { Notifications } from '../core/notifications';
import { Session } from '../core/session';
import { Notification } from '../core/models';
import { entityLink } from '../shared/ui';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'space_dashboard', link: '/dashboard' },
  { label: 'Action Center', icon: 'bolt', link: '/maintenance/action-center', roles: MAINTENANCE },
  { label: 'Review Queue', icon: 'fact_check', link: '/maintenance/review-queue', roles: MAINTENANCE },
  { label: 'Reports', icon: 'report', link: '/maintenance/reports', roles: MAINTENANCE },
  { label: 'Work Orders', icon: 'construction', link: '/work-orders', roles: WORK_ROLES },
  { label: 'Procurement', icon: 'local_shipping', link: '/procurement/inbox', roles: PROCUREMENT_READERS },
  { label: 'Users', icon: 'group', link: '/admin/users', roles: ['ADMIN'] },
  { label: 'AI Knowledge', icon: 'psychology', link: '/admin/knowledge', roles: ['ADMIN'] },
];

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, DatePipe, MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatBadgeModule, MatMenuModule, MatTooltipModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class ShellComponent implements OnInit {
  readonly session = inject(Session);
  readonly inbox = inject(Notifications);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 960px)').pipe(map((r) => r.matches)), {
    initialValue: false,
  });
  readonly navOpen = signal(true);
  readonly nav = computed(() => NAV.filter((n) => !n.roles || this.session.has(...n.roles)));
  readonly roleLabel = computed(() => ROLE_LABEL[this.session.role() ?? 'ADMIN']);
  readonly initials = computed(() =>
    (this.session.user()?.fullName ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase(),
  );
  readonly recent = computed(() => this.inbox.items().slice(0, 8));

  /** Breadcrumb trail from route `title` data. */
  readonly crumbs = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.trail()),
    ),
    { initialValue: this.trail() },
  );

  ngOnInit(): void {
    void this.inbox.start();
  }

  open(n: Notification): void {
    void this.inbox.markRead(n).catch(() => undefined);
    const link = entityLink(n.entityType, n.entityId, n.payload);
    if (link) void this.router.navigateByUrl(link);
  }

  closeOnMobile(drawer: { close: () => void }): void {
    if (this.mobile()) drawer.close();
  }

  private trail(): string[] {
    const out: string[] = [];
    let r: ActivatedRoute | null = this.route.root;
    while (r) {
      const t = r.snapshot.data['crumb'] as string | undefined;
      if (t && out.at(-1) !== t) out.push(t);
      r = r.firstChild;
    }
    return out;
  }
}
