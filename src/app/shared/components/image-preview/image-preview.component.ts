import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ImagePreviewData {
  urls: string[];
  index: number;
}

/** Opens photos in an in-app viewer (Esc / backdrop closes, arrow keys browse) instead of a new tab. */
export function previewImages(dialog: MatDialog, urls: string[], index = 0): void {
  if (!urls.length) return;
  dialog.open(ImagePreviewComponent, {
    data: { urls, index } satisfies ImagePreviewData,
    panelClass: 'image-preview-panel',
    backdropClass: 'image-preview-backdrop',
    maxWidth: '96vw',
    autoFocus: 'dialog',
    ariaLabel: 'Photo preview',
  });
}

@Component({
  selector: 'app-image-preview',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './image-preview.component.html',
  styleUrl: './image-preview.component.scss',
  host: {
    '(document:keydown.arrowleft)': 'step(-1)',
    '(document:keydown.arrowright)': 'step(1)',
  },
})
export class ImagePreviewComponent {
  readonly data = inject<ImagePreviewData>(MAT_DIALOG_DATA);
  readonly index = signal(this.data.index);
  readonly src = computed(() => this.data.urls[this.index()]);

  step(delta: number): void {
    const n = this.data.urls.length;
    this.index.update((i) => (i + delta + n) % n);
  }
}
