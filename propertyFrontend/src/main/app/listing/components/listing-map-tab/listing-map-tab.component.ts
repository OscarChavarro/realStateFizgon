import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { GoogleMapComponent } from 'src/app/core/maps/components/google-map/google-map.component';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { ListingPropertyRow } from 'src/app/listing/model/listing.types';

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

  @Input({ required: true })
  set properties(value: ListingPropertyRow[]) {
    this.listingProperties = Array.isArray(value) ? value : [];
    this.mapProperties = this.buildMapProperties(this.listingProperties);
  }

  get properties(): ListingPropertyRow[] {
    return this.listingProperties;
  }

  @Input({ required: true }) selectedLanguage: SupportedLanguage = 'en';
  @Input() googleMapsApiKey: string | null = null;
  @Input() googleMapsMapId: string | null = null;
  mapProperties: GoogleMapProperty[] = [];

  private buildMapProperties(properties: ListingPropertyRow[]): GoogleMapProperty[] {
    const output: GoogleMapProperty[] = [];
    for (const property of properties) {
      const lat = property.geoLocationHint?.lat;
      const lon = property.geoLocationHint?.lon;
      if (
        typeof lat !== 'number'
        || typeof lon !== 'number'
        || !Number.isFinite(lat)
        || !Number.isFinite(lon)
      ) {
        continue;
      }

      output.push({
        id: property.propertyId || property.url || property.title,
        title: property.title || '-',
        latitude: lat,
        longitude: lon,
        unavailable: property.unavailable === true
      });
    }

    return output;
  }
}
