import { ListingPropertyRow } from 'src/app/listing/model/listing.types';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';

export function applyListingFilters(
  rows: ListingPropertyRow[],
  filters: ListingFiltersState
): ListingPropertyRow[] {
  if (!filters.showClosed) {
    return rows.filter((row) => !row.unavailable);
  }

  return rows;
}
