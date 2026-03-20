import { PropertyFeatureGroup } from 'domain/property/property-feature-group.model';
import { GeoLocationHint } from 'domain/property/geo-location-hint.model';
import { PropertyImage } from 'domain/property/property-image.model';
import { PropertyMainFeatures } from 'domain/property/property-main-features.model';

export class Property {
  constructor(
    public readonly propertyId: string | null,
    public readonly url: string,
    public readonly title: string | null,
    public readonly location: string | null,
    public readonly price: number | null,
    public readonly mainFeatures: PropertyMainFeatures,
    public readonly advertiserComment: string | null,
    public readonly featureGroups: PropertyFeatureGroup[],
    public readonly publicationAge: string | null,
    public readonly images: PropertyImage[],
    public readonly geoLocationHint: GeoLocationHint | null | undefined = undefined
  ) {}
}
