export type ListingTab = 'DASHBOARD' | 'MAP_TAB' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB';

export type GeoLocationHint = {
  lat: number;
  lon: number;
};

export type ListingPropertyRow = {
  propertyId: string;
  publicationDate: string;
  publicationDateShort: string;
  title: string;
  url: string;
  price: string;
  area?: string;
  bedrooms?: string;
  location: string;
  advertiserComment: string;
  localImageUrls: string[];
  unavailable: boolean;
  geoLocationHint: GeoLocationHint | null;
};

export type PropertyReviewLabel = 'NEW' | 'FAVOURITE' | 'DISCHARGED';

export type PropertyLabels = {
  review?: PropertyReviewLabel;
  comment?: string;
  [key: string]: unknown;
};

export type PropertyLabelEntry = {
  propertyId: string;
  labels: PropertyLabels;
};

export type SortDirection = 'asc' | 'desc';

export type SortField = 'publicationDate' | 'title' | 'price';

export type SortCriterion = {
  sortBy: SortField;
  sortOrder: SortDirection;
};

export type SortToggleRequest = {
  sortBy: SortField;
};
