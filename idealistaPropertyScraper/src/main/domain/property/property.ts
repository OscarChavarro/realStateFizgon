import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { GeoLocationHint } from 'domain/property/geo-location-hint';
import { Price } from 'domain/property/price';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyId } from 'domain/property/property-id';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { PropertyUrl } from 'domain/property/property-url';

export type PropertyPrimitives = {
  propertyId: string | null;
  url: string;
  title: string | null;
  location: string | null;
  price: number | null;
  mainFeatures: PropertyMainFeatures;
  advertiserComment: string | null;
  featureGroups: PropertyFeatureGroup[];
  publicationAge: string | null;
  images: PropertyImage[];
  geoLocationHint?: GeoLocationHint | null;
};

export type PropertyCreateParams = Omit<PropertyPrimitives, 'url'> & {
  url: string | PropertyUrl;
};

export class Property {
  private constructor(
    public readonly propertyId: string | null,
    public readonly url: PropertyUrl,
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

  static create(params: PropertyCreateParams): Property {
    const propertyUrl = params.url instanceof PropertyUrl ? params.url : PropertyUrl.create(params.url);
    const propertyId = this.resolvePropertyId(params.propertyId, propertyUrl);
    const price = Price.createOptional(params.price);
    const normalizedTitle = this.normalizeOptionalText(params.title);
    const normalizedLocation = this.normalizeOptionalText(params.location);
    const normalizedAdvertiserComment = this.normalizeOptionalText(params.advertiserComment);
    const normalizedPublicationAge = this.normalizeOptionalText(params.publicationAge);

    return new Property(
      propertyId?.value ?? null,
      propertyUrl,
      normalizedTitle,
      normalizedLocation,
      price?.toNumber() ?? null,
      params.mainFeatures,
      normalizedAdvertiserComment,
      [...params.featureGroups],
      normalizedPublicationAge,
      [...params.images],
      params.geoLocationHint
    );
  }

  withGeoLocationHint(geoLocationHint: GeoLocationHint | null): Property {
    return Property.create({
      ...this.toPrimitives(),
      geoLocationHint
    });
  }

  withImages(images: PropertyImage[]): Property {
    return Property.create({
      ...this.toPrimitives(),
      images
    });
  }

  withPropertyId(propertyId: string | null): Property {
    return Property.create({
      ...this.toPrimitives(),
      propertyId
    });
  }

  toPrimitives(): PropertyPrimitives {
    return {
      propertyId: this.propertyId,
      url: this.url.value,
      title: this.title,
      location: this.location,
      price: this.price,
      mainFeatures: this.mainFeatures,
      advertiserComment: this.advertiserComment,
      featureGroups: [...this.featureGroups],
      publicationAge: this.publicationAge,
      images: [...this.images],
      geoLocationHint: this.geoLocationHint
    };
  }

  get propertyIdValueObject(): PropertyId | null {
    return PropertyId.tryCreate(this.propertyId);
  }

  get urlValueObject(): PropertyUrl {
    return this.url;
  }

  get priceValueObject(): Price | null {
    return Price.createOptional(this.price);
  }

  private static resolvePropertyId(propertyId: string | null, propertyUrl: PropertyUrl): PropertyId | null {
    const propertyIdValueObject = propertyId === null ? null : PropertyId.create(propertyId);

    if (propertyIdValueObject && propertyUrl.propertyId && !propertyIdValueObject.equals(propertyUrl.propertyId)) {
      throw new Error(`PropertyId "${propertyIdValueObject.value}" does not match URL "${propertyUrl.value}".`);
    }

    return propertyIdValueObject ?? propertyUrl.propertyId ?? null;
  }

  private static normalizeOptionalText(value: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
