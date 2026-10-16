import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable, Subject, catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { toAppError } from '@app/core/http/app-error';
import { RecentSearchesService } from '@app/core/search/recent-searches.service';
import { SEARCH_MAX, SEARCH_MIN, SearchGroup, SearchService, safeRoute, searchable } from '@app/core/search/search.service';

export const SEARCH_DEBOUNCE_MS = 250;

interface SearchState {
  status: 'idle' | 'loading' | 'done' | 'error';
  /** The trimmed query this state answers. */
  q: string;
  groups: SearchGroup[];
  error?: string;
}

/** A keyboard-selectable row: a recent query, or a result with a route. */
interface Option {
  id: string;
  kind: 'recent' | 'result';
  label: string;
  route?: string;
}

const IDLE: SearchState = { status: 'idle', q: '', groups: [] };

/**
 * Spotlight overlay (opened by SpotlightLauncherComponent). ARIA combobox + listbox: focus stays in the input,
 * arrows move `aria-activedescendant`, Enter opens, Esc closes (MatDialog). Results are never stored.
 */
@Component({
  selector: 'app-spotlight',
  imports: [MatIconModule, MatButtonModule, MatProgressBarModule],
  templateUrl: './spotlight.component.html',
  styleUrl: './spotlight.component.scss',
})
export class SpotlightComponent {
  private readonly api = inject(SearchService);
  private readonly router = inject(Router);
  private readonly ref = inject(MatDialogRef<SpotlightComponent>, { optional: true });
  readonly recents = inject(RecentSearchesService);

  readonly max = SEARCH_MAX;
  readonly query = signal('');
  readonly active = signal(0);
  private readonly state = signal<SearchState>(IDLE);
  private readonly input$ = new Subject<string>();

  readonly trimmed = computed(() => this.query().trim());
  readonly blank = computed(() => !this.trimmed());
  readonly tooShort = computed(() => !this.blank() && this.trimmed().length < SEARCH_MIN);
  /** Only the answer to the CURRENT query is shown, so a slow older response can never surface. */
  readonly current = computed<SearchState>(() => {
    const s = this.state();
    if (!searchable(this.trimmed())) return IDLE;
    return s.q === this.trimmed() ? s : { status: 'loading', q: this.trimmed(), groups: [] };
  });
  readonly groups = computed(() => this.current().groups);

  readonly options = computed<Option[]>(() => {
    if (this.blank()) return this.recents.items().map((q, i) => ({ id: `spot-recent-${i}`, kind: 'recent', label: q }));
    return this.groups().flatMap((g) =>
      g.items
        .filter((it) => safeRoute(it.route))
        .map((it) => ({ id: optionId(g.type, it.id), kind: 'result' as const, label: it.title, route: safeRoute(it.route)! })),
    );
  });
  readonly activeId = computed(() => this.options()[this.active()]?.id ?? null);

  readonly announce = computed(() => {
    if (this.blank()) return this.recents.items().length ? `${this.recents.items().length} recent searches` : '';
    if (this.tooShort()) return `Type at least ${SEARCH_MIN} characters`;
    const s = this.current();
    if (s.status === 'loading') return 'Searching…';
    if (s.status === 'error') return s.error ?? 'Search failed';
    const n = s.groups.reduce((sum, g) => sum + g.items.length, 0);
    return n ? `${n} results` : `No results for ${s.q}`;
  });

  readonly optionId = optionId;
  readonly safeRoute = safeRoute;

  constructor() {
    this.input$
      .pipe(
        map((q) => q.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        // switchMap unsubscribes the previous request, which cancels it in HttpClient.
        switchMap((q) => (searchable(q) ? this.fetch(q) : of(IDLE))),
        takeUntilDestroyed(),
      )
      .subscribe((s) => {
        this.state.set(s);
        this.active.set(0);
      });
  }

  onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.input$.next(value);
  }

  retry(): void {
    this.input$.next(this.query());
  }

  onKey(e: KeyboardEvent): void {
    const n = this.options().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.active.set((this.active() + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
      const id = this.activeId();
      if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' }));
    } else if (e.key === 'Enter') {
      const opt = this.options()[this.active()];
      if (opt) {
        e.preventDefault();
        this.choose(opt);
      }
    } else if (e.key === 'Delete' && this.blank()) {
      const opt = this.options()[this.active()];
      if (opt) {
        e.preventDefault();
        this.removeRecent(opt.label);
      }
    }
  }

  choose(opt: Option): void {
    if (opt.kind === 'recent') {
      this.onInput(opt.label);
      return;
    }
    this.recents.add(this.trimmed());
    this.ref?.close();
    void this.router.navigateByUrl(opt.route!);
  }

  chooseById(id: string): void {
    const i = this.options().findIndex((o) => o.id === id);
    if (i >= 0) this.choose(this.options()[i]);
  }

  removeRecent(q: string): void {
    this.recents.remove(q);
    this.active.set(Math.min(this.active(), Math.max(0, this.recents.items().length - 1)));
  }

  private fetch(q: string): Observable<SearchState> {
    return this.api.search(q).pipe(
      map((r): SearchState => ({ status: 'done', q, groups: (r.groups ?? []).filter((g) => g.items?.length) })),
      catchError((e: unknown) => of<SearchState>({ status: 'error', q, groups: [], error: toAppError(e).message })),
      startWith<SearchState>({ status: 'loading', q, groups: [] }),
    );
  }
}

function optionId(type: string, id: string): string {
  return `spot-${type}-${id}`.replace(/[^\w-]/g, '_');
}
