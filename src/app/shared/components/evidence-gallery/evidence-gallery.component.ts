import { Component, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { previewImages } from '../image-preview/image-preview.component';

/** Evidence thumbnails; opens the Cloudinary URL from the API in the in-app viewer. */
@Component({
  selector: 'app-evidence-gallery',
  imports: [MatIconModule],
  templateUrl: './evidence-gallery.component.html',
  styleUrl: './evidence-gallery.component.scss',
})
export class EvidenceGalleryComponent {
  private readonly dialog = inject(MatDialog);
  readonly urls = input<string[]>([]);

  open(index: number): void {
    previewImages(this.dialog, this.urls(), index);
  }
}
