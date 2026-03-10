import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import {
  DashboardPropertyRow,
  PropertyLabelEntry,
  PropertyReviewLabel
} from 'src/app/dashboard/dashboard.types';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';
import { PropertyImageCarouselComponent } from 'src/app/propertydetail/property-image-carousel.component';

@Component({
  selector: 'app-property-detail-panel',
  standalone: true,
  imports: [PropertyImageCarouselComponent],
  templateUrl: './property-detail-panel.component.html',
  styleUrl: './property-detail-panel.component.css'
})
export class PropertyDetailPanelComponent {
  private readonly i18nService = inject(I18nService);
  private readonly draftComments = new Map<string, string>();

  @Input() property: DashboardPropertyRow | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';
  @Input() staticMediaBaseUrl = 'http://localhost:666/';
  @Input() reviewEnabled = false;
  @Input() propertyLabels: PropertyLabelEntry[] = [];
  @Output() readonly propertyReviewToggle = new EventEmitter<DashboardPropertyRow>();

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  getReviewClass(propertyId: string): string {
    const review = this.getReview(propertyId);
    if (review === 'FAVOURITE') {
      return 'favourite';
    }
    if (review === 'DISCHARGED') {
      return 'discharged';
    }
    return 'new';
  }

  getReviewIcon(propertyId: string): string {
    const review = this.getReview(propertyId);
    if (review === 'FAVOURITE') {
      return 'check';
    }
    if (review === 'DISCHARGED') {
      return 'close';
    }
    return 'flare';
  }

  getReviewText(propertyId: string): string {
    const review = this.getReview(propertyId);
    if (review === 'FAVOURITE') {
      return this.t('REVIEW_FAVOURITE');
    }
    if (review === 'DISCHARGED') {
      return this.t('REVIEW_DISCHARGED');
    }
    return this.t('REVIEW_NEW');
  }

  getDraftComment(propertyId: string): string {
    return this.draftComments.get(propertyId) ?? '';
  }

  onDraftCommentInput(propertyId: string, event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.draftComments.set(propertyId, value);
  }

  onPropertyReviewToggleClick(property: DashboardPropertyRow): void {
    this.propertyReviewToggle.emit(property);
  }

  private getReview(propertyId: string): PropertyReviewLabel {
    const labels = this.propertyLabels.find((item) => item.propertyId === propertyId)?.labels;
    const review = labels?.review;
    if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
      return review;
    }
    return 'NEW';
  }
}
