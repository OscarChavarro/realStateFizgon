export type DashboardFiltersState = {
  showClosed: boolean;
};

export function createDefaultDashboardFilters(): DashboardFiltersState {
  return {
    showClosed: true
  };
}
