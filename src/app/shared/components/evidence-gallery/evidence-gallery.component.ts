import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Evidence thumbnails; opens the Cloudinary URL from the API in a new tab. */
@Component({
  selector: 'app-evidence-gallery',
  imports: [MatIconModule],
  templateUrl: './evidence-gallery.component.html',
  styleUrl: './evidence-gallery.component.scss',
})
export class EvidenceGalleryComponent {
  readonly urls = input<string[]>([]);
}
