export type DashboardTab = 'DASHBOARD' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB';

export type DashboardPropertyRow = {
  propertyId: string;
  createdAt: string;
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
  propertyComments?: string;
  [key: string]: unknown;
};

export type PropertyLabelEntry = {
  propertyId: string;
  labels: PropertyLabels;
};

export type SortDirection = 'asc' | 'desc';

export type SortField = 'importedBy' | 'title' | 'price';

export type SortCriterion = {
  sortBy: SortField;
  sortOrder: SortDirection;
};

export type SortToggleRequest = {
  sortBy: SortField;
  sortOrder: SortDirection;
};
