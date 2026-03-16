import { GeoLocationHint, ListingPropertyRow, SortCriterion } from 'src/app/listing/model/listing.types';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import { ListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';

export type PropertiesCountResponse = {
  count: number;
};

export type FrontendSecrets = {
  staticMedia?: string;
  backend?: {
    baseUrl?: string;
  };
  google?: {
    maps?: {
      'api-key'?: string;
      'map-id'?: string;
    };
  };
};

export type PropertiesResponse = {
  error: string | null;
  data: Array<{
    publicationDate?: string | Date;
    closedBy?: string | Date | null;
    closedby?: string | Date | null;
    closed_by?: string | Date | null;
    isClosed?: boolean | string | number | null;
    closedByExists?: boolean | string | number | null;
    propertyId?: string | number;
    title?: string;
    location?: string;
    description?: string;
    advertiserComment?: string;
    url?: string;
    price?: number | string | null;
    mainFeatures?: {
      area?: string | number | null;
      bedrooms?: string | number | null;
    } | null;
    images?: Array<string | {
      url?: string;
      localUrl?: string | null;
      title?: string | null;
    }>;
    geoLocationHint?: {
      lat?: number | string | null;
      lon?: number | string | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
    } | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalElements: number;
  };
};

export type ListingDataResult = {
  count: number;
  properties: ListingPropertyRow[];
  pagination: ListingPaginationState;
};

export type ListingConfiguration = {
  backendBaseUrl: string;
  staticMediaBaseUrl: string;
  googleMapsApiKey: string | null;
  googleMapsMapId: string | null;
};

export type BuildPropertiesEndpointUrlParams = {
  sortCriteria: SortCriterion[];
  filters: ListingFiltersState;
  page: number;
  pageSize: number;
  includePaginationParams: boolean;
};

export type ParseGeoLocationHintInput = PropertiesResponse['data'][number]['geoLocationHint'];
export type ExtractLocalImageUrlsInput = PropertiesResponse['data'][number]['images'];
export type PropertiesPayloadRow = PropertiesResponse['data'][number];
export type ParsedGeoLocationHint = GeoLocationHint | null;
