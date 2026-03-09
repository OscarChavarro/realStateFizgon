export type DashboardFiltersState = {
  showClosedProperties: boolean;
};

export function createDefaultDashboardFilters(): DashboardFiltersState {
  return {
    showClosedProperties: true
  };
}
