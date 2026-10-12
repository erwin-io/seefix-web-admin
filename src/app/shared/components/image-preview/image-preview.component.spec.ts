import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { EvidenceGalleryComponent } from '../evidence-gallery/evidence-gallery.component';
import { ImagePreviewComponent } from './image-preview.component';

describe('ImagePreviewComponent', () => {
  it('starts at the clicked photo and wraps around both ends', () => {
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { urls: ['a', 'b', 'c'], index: 1 } }] });
    const viewer = TestBed.createComponent(ImagePreviewComponent).componentInstance;
    expect(viewer.src()).toBe('b');
    viewer.step(1);
    viewer.step(1);
    expect(viewer.src()).toBe('a');
    viewer.step(-1);
    expect(viewer.src()).toBe('c');
  });

  it('gallery thumbnails open the in-app viewer (not a new tab) at the clicked photo', () => {
    const open = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: { open } }] });
    const fixture = TestBed.createComponent(EvidenceGalleryComponent);
    fixture.componentRef.setInput('urls', ['u1', 'u2']);
    fixture.detectChanges();
    const thumbs = fixture.nativeElement.querySelectorAll('button.thumb');
    expect(fixture.nativeElement.querySelector('a[target="_blank"]')).toBeNull();
    thumbs[1].click();
    expect(open).toHaveBeenCalledWith(ImagePreviewComponent, expect.objectContaining({ data: { urls: ['u1', 'u2'], index: 1 } }));
  });
});
