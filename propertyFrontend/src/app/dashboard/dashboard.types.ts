export type DashboardTab = 'DASHBOARD' | 'DATABASE_MAINTENANCE_TAB';

export type DashboardPropertyRow = {
  propertyId: string;
  createdAt: string;
  title: string;
  url: string;
  price: string;
  location: string;
  advertiserComment: string;
  localImageUrls: string[];
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
