import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RecentSearchesService } from '@app/core/search/recent-searches.service';
import { SpotlightComponent } from './spotlight.component';

/** Header search button + global Ctrl+K / Cmd+K shortcut. */
@Component({
  selector: 'app-spotlight-launcher',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <button mat-icon-button type="button" aria-label="Search (Ctrl+K)" aria-haspopup="dialog" matTooltip="Search (Ctrl+K)" (click)="open()">
      <mat-icon>search</mat-icon>
    </button>
  `,
})
export class SpotlightLauncherComponent {
  private readonly dialog = inject(MatDialog);
  private ref: MatDialogRef<SpotlightComponent> | null = null;

  constructor() {
    // Created with the signed-in shell, so the history purge is registered before any sign-out.
    inject(RecentSearchesService);
  }

  onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.open();
    }
  }

  open(): void {
    if (this.ref) return;
    this.ref = this.dialog.open(SpotlightComponent, {
      width: '640px',
      maxWidth: '94vw',
      position: { top: '10vh' },
      autoFocus: 'input.spot-input',
      restoreFocus: true,
      ariaLabelledBy: 'spot-title',
      panelClass: 'spotlight-panel',
    });
    this.ref.afterClosed().subscribe(() => (this.ref = null));
  }
}
