import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AssistantPanelComponent } from './assistant-panel.component';
import { AssistantStore, PanelView } from './assistant.store';

/**
 * The single global mount point (in the shell): floating launcher, minimized bar and the panel. Rendered only for
 * the internal roles the API serves; it disappears when `/api/assistant/tools` answers 403/404.
 */
@Component({
  selector: 'app-assistant-launcher',
  imports: [MatBadgeModule, MatButtonModule, MatIconModule, AssistantPanelComponent],
  template: `
    @if (store.visible()) {
      @switch (store.view()) {
        @case ('open') {
          <app-assistant-panel />
        }
        @case ('minimized') {
          <div class="mini" role="region" aria-label="SEEFIX Assistant, minimized">
            <button #restore mat-button type="button" aria-haspopup="dialog" (click)="store.open()">
              <mat-icon>smart_toy</mat-icon>SEEFIX Assistant{{
                store.pending() ? ' · thinking…' : ''
              }}
            </button>
            <button
              mat-icon-button
              type="button"
              aria-label="Close assistant"
              (click)="store.close()"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
        @default {
          <button
            #fab
            mat-fab
            type="button"
            class="fab"
            aria-haspopup="dialog"
            [attr.aria-label]="label()"
            (click)="store.open()"
          >
            <mat-icon
              [matBadge]="store.hints().length || null"
              matBadgeColor="warn"
              matBadgeSize="small"
              aria-hidden="true"
              >smart_toy</mat-icon
            >
          </button>
        }
      }
    }
  `,
  styles: `
    :host {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 1000;
    }
    .mini {
      display: flex;
      align-items: center;
      background: var(--sf-surface);
      border: 1px solid var(--sf-border);
      border-radius: 24px;
      box-shadow: 0 6px 20px rgba(20, 33, 58, 0.2);
      padding: 2px 4px 2px 8px;
    }
    @media (max-width: 600px) {
      :host {
        right: 16px;
        bottom: 16px;
      }
    }
  `,
})
export class AssistantLauncherComponent implements OnInit {
  readonly store = inject(AssistantStore);
  private readonly injector = inject(Injector);
  private readonly fab = viewChild('fab', { read: ElementRef<HTMLElement> });
  private readonly restore = viewChild('restore', { read: ElementRef<HTMLElement> });

  readonly label = computed(() => {
    const n = this.store.hints().length;
    return n
      ? `Open SEEFIX Assistant, ${n} queue hint${n === 1 ? '' : 's'}`
      : 'Open SEEFIX Assistant';
  });

  constructor() {
    // Closing or minimizing the panel returns focus to the control that brings it back.
    let last: PanelView = this.store.view();
    effect(() => {
      const view = this.store.view();
      if (last === 'open' && view !== 'open') {
        afterNextRender(
          () => (view === 'minimized' ? this.restore() : this.fab())?.nativeElement.focus(),
          { injector: this.injector },
        );
      }
      last = view;
    });
  }

  ngOnInit(): void {
    void this.store.init();
  }
}
