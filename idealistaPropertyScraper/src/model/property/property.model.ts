import { PropertyFeatureGroup } from './property-feature-group.model';
import { PropertyImage } from './property-image.model';
import { PropertyMainFeatures } from './property-main-features.model';

export class Property {
  constructor(
    public readonly url: string,
    public readonly title: string | null,
    public readonly location: string | null,
    public readonly price: string | null,
    public readonly mainFeatures: PropertyMainFeatures,
    public readonly advertiserComment: string | null,
    public readonly featureGroups: PropertyFeatureGroup[],
    public readonly publicationAge: string | null,
    public readonly images: PropertyImage[]
  ) {}
}
