export type ListingFiltersState = {
  showClosed: boolean;
  showNew: boolean;
  showFavourite: boolean;
  showRejected: boolean;
  minPublicationDate: string;
  maxPublicationDate: string;
  minPrice: string;
  maxPrice: string;
};

export function createDefaultListingFilters(): ListingFiltersState {
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
