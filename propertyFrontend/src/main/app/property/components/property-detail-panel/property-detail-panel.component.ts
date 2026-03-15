import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import {
  ListingPropertyRow,
  PropertyLabelEntry,
  PropertyReviewLabel
} from 'src/app/listing/model/listing.types';
import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/core/i18n/services/i18n.service';
import { PropertyImageCarouselComponent } from 'src/app/property/components/property-image-carousel/property-image-carousel.component';
import { PropertyLocationComponent } from 'src/app/property/components/property-location/property-location.component';

@Component({
  selector: 'app-property-detail-panel',
  standalone: true,
  imports: [PropertyImageCarouselComponent, PropertyLocationComponent],
  templateUrl: './property-detail-panel.component.html',
  styleUrl: './property-detail-panel.component.scss'
})
export class PropertyDetailPanelComponent {
  private readonly i18nService = inject(I18nService);
  private readonly draftComments = new Map<string, string>();

  @Input() property: ListingPropertyRow | null = null;
  @Input() selectedLanguage: SupportedLanguage = 'en';
  @Input() staticMediaBaseUrl = 'http://localhost:666/';
  @Input() googleMapsApiKey: string | null = null;
  @Input() googleMapsMapId: string | null = null;
  @Input() reviewEnabled = false;
  @Input() propertyLabels: PropertyLabelEntry[] = [];
  @Output() readonly propertyReviewToggle = new EventEmitter<ListingPropertyRow>();
  @Output() readonly propertyCommentSave = new EventEmitter<{ property: ListingPropertyRow; comment: string }>();
  isLocationDialogOpen = false;

  t(id: TranslationKey): string {
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
    const draftComment = this.draftComments.get(propertyId);
    if (draftComment !== undefined) {
      return draftComment;
    }

    return this.getPersistedComment(propertyId);
  }

  onDraftCommentInput(propertyId: string, event: Event): void {
    const value = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.draftComments.set(propertyId, value);
  }

  onPropertyReviewToggleClick(property: ListingPropertyRow): void {
    this.propertyReviewToggle.emit(property);
  }

  onDraftCommentBlur(property: ListingPropertyRow): void {
    const comment = this.getDraftComment(property.propertyId).trim();
    this.draftComments.set(property.propertyId, comment);
    this.propertyCommentSave.emit({ property, comment });
  }

  hasGeoLocationHint(property: ListingPropertyRow | null): boolean {
    const lat = property?.geoLocationHint?.lat;
    const lon = property?.geoLocationHint?.lon;
    return Number.isFinite(lat) && Number.isFinite(lon);
  }

  getGeoLatitude(property: ListingPropertyRow | null): number | null {
    return this.hasGeoLocationHint(property) ? property?.geoLocationHint?.lat ?? null : null;
  }

  getGeoLongitude(property: ListingPropertyRow | null): number | null {
    return this.hasGeoLocationHint(property) ? property?.geoLocationHint?.lon ?? null : null;
  }

  openLocationDialog(): void {
    this.isLocationDialogOpen = true;
  }

  closeLocationDialog(): void {
    this.isLocationDialogOpen = false;
  }

  getPublicationDateExtended(publicationDate: string): string {
    const parsedDate = this.parsePublicationDate(publicationDate);
    if (!parsedDate) {
      return publicationDate || '-';
    }

    const locale = this.selectedLanguage === 'sp' ? 'es-ES' : 'en-US';
    const monthText = new Intl.DateTimeFormat(locale, { month: 'long' }).format(parsedDate);
    const year = String(parsedDate.getFullYear());
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const timeText = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(parsedDate);

    return `${year} ${monthText} ${day} ${timeText}`;
  }

  private getReview(propertyId: string): PropertyReviewLabel {
    const labels = this.propertyLabels.find((item) => item.propertyId === propertyId)?.labels;
    const review = labels?.review;
    if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
      return review;
    }
    return 'NEW';
  }

  private getPersistedComment(propertyId: string): string {
    const labels = this.propertyLabels.find((item) => item.propertyId === propertyId)?.labels;
    const comment = labels?.comment;
    if (typeof comment === 'string') {
      return comment;
    }

    return '';
  }

  private parsePublicationDate(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsedDateOnly = new Date(`${trimmed}T00:00:00`);
      return Number.isNaN(parsedDateOnly.getTime()) ? null : parsedDateOnly;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
