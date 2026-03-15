import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/core/i18n/services/i18n.service';
import { PropertyMiniImageCarouselComponent } from 'src/app/core/maps/components/property-mini-image-carousel/property-mini-image-carousel.component';
import { GoogleMapProperty, GoogleMapPropertyReview } from 'src/app/core/maps/model/google-map-property.model';

@Component({
  selector: 'app-property-mini-summary',
  standalone: true,
  imports: [PropertyMiniImageCarouselComponent],
  templateUrl: './property-mini-summary.component.html',
  styleUrl: './property-mini-summary.component.scss'
})
export class PropertyMiniSummaryComponent {
  private readonly i18nService = inject(I18nService);

  @Input({ required: true }) property!: GoogleMapProperty;
  @Input() selectedLanguage: SupportedLanguage = 'en';
  @Output() readonly closeRequested = new EventEmitter<void>();

  onCloseClick(): void {
    this.closeRequested.emit();
  }

  t(id: TranslationKey): string {
    return this.i18nService.get(id, this.selectedLanguage);
  }

  getReviewClass(): string {
    if (this.property.review === 'FAVOURITE') {
      return 'favourite';
    }
    if (this.property.review === 'DISCHARGED') {
      return 'discharged';
    }
    return 'new';
  }

  getReviewIcon(): string {
    if (this.property.review === 'FAVOURITE') {
      return 'check';
    }
    if (this.property.review === 'DISCHARGED') {
      return 'close';
    }
    return 'flare';
  }

  getReviewText(): string {
    const review = this.property.review;
    return this.reviewToTranslation(review);
  }

  private reviewToTranslation(review: GoogleMapPropertyReview): string {
    if (review === 'FAVOURITE') {
      return this.t('REVIEW_FAVOURITE');
    }
    if (review === 'DISCHARGED') {
      return this.t('REVIEW_DISCHARGED');
    }
    return this.t('REVIEW_NEW');
  }
}
