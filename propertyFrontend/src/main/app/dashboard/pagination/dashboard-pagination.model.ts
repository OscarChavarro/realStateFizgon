export const DASHBOARD_PAGE_SIZE_OPTIONS = [100, 500, 1000] as const;

export type DashboardPageSize = (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number];

export type DashboardPaginationState = {
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
};

export function createDefaultDashboardPaginationState(): DashboardPaginationState {
  return {
    page: 1,
    pageSize: 100,
    totalElements: 0,
    totalPages: 0
  };
}
