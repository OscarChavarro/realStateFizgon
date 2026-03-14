export type DashboardTab = 'DASHBOARD' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB';

export type DashboardPropertyRow = {
  propertyId: string;
  publicationDate: string;
  publicationDateShort: string;
  title: string;
  url: string;
  price: string;
  location: string;
  advertiserComment: string;
  localImageUrls: string[];
  unavailable: boolean;
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
