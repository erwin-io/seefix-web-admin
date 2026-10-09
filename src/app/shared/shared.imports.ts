import { EvidenceGalleryComponent } from './components/evidence-gallery/evidence-gallery.component';
import { PageStateComponent } from './components/page-state/page-state.component';
import { PriorityBadgeComponent } from './components/priority-badge/priority-badge.component';
import { StatusChipComponent } from './components/status-chip/status-chip.component';
import { HumanizePipe } from './pipes/humanize.pipe';

// Re-exported so the Angular compiler can resolve them through this module.
export { EvidenceGalleryComponent, HumanizePipe, PageStateComponent, PriorityBadgeComponent, StatusChipComponent };

/** Common building blocks most pages import together. */
export const SHARED_IMPORTS = [HumanizePipe, StatusChipComponent, PriorityBadgeComponent, PageStateComponent, EvidenceGalleryComponent];
