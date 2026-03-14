import { DashboardPropertyRow } from 'src/app/dashboard/dashboard.types';
import { DashboardFiltersState } from 'src/app/dashboard/filters/dashboard-filters.model';

export function applyDashboardFilters(
  rows: DashboardPropertyRow[],
  filters: DashboardFiltersState
): DashboardPropertyRow[] {
  if (!filters.showClosed) {
    return rows.filter((row) => !row.unavailable);
  }

  return rows;
}
