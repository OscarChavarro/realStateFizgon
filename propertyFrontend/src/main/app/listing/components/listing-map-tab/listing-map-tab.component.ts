import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { GoogleMapComponent } from 'src/app/core/maps/components/google-map/google-map.component';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';
import {
  ListingPropertyRow,
  PropertyLabelEntry,
  PropertyReviewLabel
} from 'src/app/listing/model/listing.types';

@Component({
  selector: 'app-listing-map-tab',
  standalone: true,
  imports: [GoogleMapComponent],
  templateUrl: './listing-map-tab.component.html',
  styleUrl: './listing-map-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListingMapTabComponent {
  private listingProperties: ListingPropertyRow[] = [];
  private listingPropertyLabels: PropertyLabelEntry[] = [];

  @Input({ required: true })
  set properties(value: ListingPropertyRow[]) {
    this.listingProperties = Array.isArray(value) ? value : [];
    this.rebuildMapProperties();
  }

  get properties(): ListingPropertyRow[] {
    return this.listingProperties;
  }

  @Input()
  set propertyLabels(value: PropertyLabelEntry[]) {
    this.listingPropertyLabels = Array.isArray(value) ? value : [];
    this.rebuildMapProperties();
  }

  get propertyLabels(): PropertyLabelEntry[] {
    return this.listingPropertyLabels;
  }

  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() googleMapsApiKey: string | null = null;
  @Input() googleMapsMapId: string | null = null;
  @Input() staticMediaBaseUrl = 'http://localhost:666/';
  mapProperties: GoogleMapProperty[] = [];

  private rebuildMapProperties(): void {
    this.mapProperties = this.buildMapProperties(
      this.listingProperties,
      this.listingPropertyLabels
    );
  }

  private buildMapProperties(
    properties: ListingPropertyRow[],
    labels: PropertyLabelEntry[]
  ): GoogleMapProperty[] {
    const output: GoogleMapProperty[] = [];
    for (const property of properties) {
      const lat = this.toFiniteNumber(property.geoLocationHint?.lat);
      const lon = this.toFiniteNumber(property.geoLocationHint?.lon);
      if (lat === null || lon === null) {
        continue;
      }

      output.push({
        id: property.propertyId || property.url || property.title,
        propertyId: property.propertyId || '',
        title: property.title || '-',
        price: property.price || '-',
        url: property.url || '',
        ...(property.area ? { area: property.area } : {}),
        ...(property.bedrooms ? { bedrooms: property.bedrooms } : {}),
        latitude: lat,
        longitude: lon,
        closed: property.unavailable === true,
        review: this.getReview(property.propertyId, labels),
        imageUrls: this.buildImageUrls(property)
      });
    }

    return output;
  }

  private getReview(propertyId: string, labels: PropertyLabelEntry[]): PropertyReviewLabel {
    const review = labels.find((item) => item.propertyId === propertyId)?.labels?.review;
    if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
      return review;
    }
    return 'NEW';
  }

  private buildImageUrls(property: ListingPropertyRow): string[] {
    const propertyId = (property.propertyId ?? '').trim();
    if (
      !propertyId ||
      !Array.isArray(property.localImageUrls) ||
      property.localImageUrls.length === 0
    ) {
      return [];
    }

    const base = this.staticMediaBaseUrl.endsWith('/')
      ? this.staticMediaBaseUrl
      : `${this.staticMediaBaseUrl}/`;

    const urls: string[] = [];
    for (const imageName of property.localImageUrls) {
      const trimmed = typeof imageName === 'string' ? imageName.trim() : '';
      if (!trimmed) {
        continue;
      }
      urls.push(`${base}${propertyId}/${trimmed}`);
    }

    return urls;
  }

  private toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number.parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (value && typeof value === 'object') {
      const decimalCandidate = (value as { $numberDecimal?: unknown }).$numberDecimal;
      if (typeof decimalCandidate === 'string' && decimalCandidate.trim().length > 0) {
        const parsed = Number.parseFloat(decimalCandidate);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }

    return null;
  }
}
