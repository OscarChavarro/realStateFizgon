export type DashboardFiltersState = {
  showClosed: boolean;
  showNew: boolean;
  showFavourite: boolean;
  showRejected: boolean;
  minPublicationDate: string;
  maxPublicationDate: string;
  minPrice: string;
  maxPrice: string;
};

export function createDefaultDashboardFilters(): DashboardFiltersState {
  return {
    showClosed: true,
    showNew: true,
    showFavourite: true,
    showRejected: true,
    minPublicationDate: '',
    maxPublicationDate: '',
    minPrice: '',
    maxPrice: ''
  };
}
