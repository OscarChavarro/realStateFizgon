export type DashboardFiltersState = {
  showClosed: boolean;
  showNew: boolean;
  showFavourite: boolean;
  showRejected: boolean;
};

export function createDefaultDashboardFilters(): DashboardFiltersState {
  return {
    showClosed: true,
    showNew: true,
    showFavourite: true,
    showRejected: true
  };
}
