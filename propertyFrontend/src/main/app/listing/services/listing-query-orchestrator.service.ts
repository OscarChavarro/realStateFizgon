import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import { DASHBOARD_PAGE_SIZE_OPTIONS, ListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { SortCriterion, SortToggleRequest, PropertyLabelEntry, ListingPropertyRow } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';

type RefreshListingDataParams = {
  http: HttpClient;
  getSortCriteria: () => SortCriterion[];
  getFilters: () => ListingFiltersState;
  getPagination: () => ListingPaginationState;
  setLoading: (loading: boolean) => void;
  setCount: (count: number) => void;
  setAllProperties: (properties: ListingPropertyRow[]) => void;
  setPagination: (pagination: ListingPaginationState) => void;
  onAfterRefresh: () => void;
  setFilteredTotalElements: (totalElements: number) => void;
};

type HandleFiltersChangeParams = {
  http: HttpClient;
  getCurrentFilters: () => ListingFiltersState;
  nextFilters: ListingFiltersState;
  getSortCriteria: () => SortCriterion[];
  getPageSize: () => number;
  getSelectedLanguage: () => SupportedLanguage;
  isAuthenticated: () => boolean;
  setFilters: (filters: ListingFiltersState) => void;
  onResetToFirstPage: () => void;
  onRefreshListingData: () => Promise<void>;
};

type ToggleSortParams = {
  http: HttpClient;
  sortBy: SortToggleRequest['sortBy'];
  getSortCriteria: () => SortCriterion[];
  getFilters: () => ListingFiltersState;
  getPageSize: () => number;
  getSelectedLanguage: () => SupportedLanguage;
  isAuthenticated: () => boolean;
  setSortCriteria: (criteria: SortCriterion[]) => void;
  onResetToFirstPage: () => void;
  onRefreshListingData: () => Promise<void>;
};

type ChangePageParams = {
  page: number;
  getPagination: () => ListingPaginationState;
  setPage: (page: number) => void;
  onRefreshListingData: () => Promise<void>;
};

type ChangePageSizeParams = {
  http: HttpClient;
  pageSize: number;
  getPagination: () => ListingPaginationState;
  setPagination: (pagination: ListingPaginationState) => void;
  getFilters: () => ListingFiltersState;
  getSortCriteria: () => SortCriterion[];
  getSelectedLanguage: () => SupportedLanguage;
  isAuthenticated: () => boolean;
  onRefreshListingData: () => Promise<void>;
};

type LoadUserPreferencesParams = {
  http: HttpClient;
  setSelectedLanguage: (language: SupportedLanguage) => void;
  persistSelectedLanguage: (language: SupportedLanguage) => void;
  setFilters: (filters: ListingFiltersState) => void;
  setSortCriteria: (criteria: SortCriterion[]) => void;
  setPageSize: (pageSize: number) => void;
  setPropertyLabels: (labels: PropertyLabelEntry[]) => void;
  setFilteredTotalElements: (totalElements: number) => void;
};

@Injectable({
  providedIn: 'root'
})
export class ListingQueryOrchestratorService {
  private static readonly FILTERED_TOTAL_ELEMENTS_KEY = 'filteredTotalElements';

  constructor(
    private readonly listingDataCoordinatorService: ListingDataCoordinatorService
  ) {}

  readFilteredTotalElementsFromSession(): number {
    const raw = sessionStorage.getItem(ListingQueryOrchestratorService.FILTERED_TOTAL_ELEMENTS_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  }

  persistFilteredTotalElementsInSession(
    totalElements: number,
    setFilteredTotalElements: (totalElements: number) => void
  ): void {
    const normalized = Number.isFinite(totalElements) && totalElements >= 0
      ? Math.floor(totalElements)
      : 0;
    setFilteredTotalElements(normalized);
    sessionStorage.setItem(ListingQueryOrchestratorService.FILTERED_TOTAL_ELEMENTS_KEY, String(normalized));
  }

  async refreshListingData(params: RefreshListingDataParams): Promise<void> {
    const currentPagination = params.getPagination();
    const requestPageSize = this.resolveRequestPageSize(currentPagination.pageSize);
    const requestPage = requestPageSize > 0 ? currentPagination.page : 1;
    const requestPagination: ListingPaginationState = {
      ...currentPagination,
      page: requestPage,
      pageSize: requestPageSize
    };

    await this.listingDataCoordinatorService.refreshListingData({
      http: params.http,
      sortCriteria: params.getSortCriteria(),
      filters: params.getFilters(),
      pagination: requestPagination,
      setLoading: params.setLoading,
      setCount: params.setCount,
      setAllProperties: params.setAllProperties,
      setPagination: (pagination) => {
        params.setPagination(pagination);
        this.persistFilteredTotalElementsInSession(pagination.totalElements, params.setFilteredTotalElements);
      },
      onAfterRefresh: params.onAfterRefresh
    });
  }

  async handleFiltersChange(params: HandleFiltersChangeParams): Promise<void> {
    await this.listingDataCoordinatorService.handleFiltersChange({
      http: params.http,
      currentFilters: params.getCurrentFilters(),
      nextFilters: params.nextFilters,
      sortCriteria: params.getSortCriteria(),
      pageSize: params.getPageSize(),
      selectedLanguage: params.getSelectedLanguage(),
      isAuthenticated: params.isAuthenticated(),
      setFilters: params.setFilters,
      onFiltersChanged: params.onResetToFirstPage,
      onRefreshListingData: params.onRefreshListingData
    });
  }

  async toggleSort(params: ToggleSortParams): Promise<void> {
    params.onResetToFirstPage();
    await this.listingDataCoordinatorService.toggleSortAndRefresh({
      http: params.http,
      currentSortCriteria: params.getSortCriteria(),
      sortBy: params.sortBy,
      filters: params.getFilters(),
      pageSize: params.getPageSize(),
      selectedLanguage: params.getSelectedLanguage(),
      isAuthenticated: params.isAuthenticated(),
      setSortCriteria: params.setSortCriteria,
      onRefreshListingData: params.onRefreshListingData
    });
  }

  async changePage(params: ChangePageParams): Promise<void> {
    const current = params.getPagination();
    const totalPages = current.totalPages;
    let normalized = Number.isFinite(params.page) ? Math.floor(params.page) : current.page;
    if (normalized < 1) {
      normalized = 1;
    }
    if (totalPages > 0 && normalized > totalPages) {
      normalized = totalPages;
    }
    if (normalized === current.page) {
      return;
    }

    params.setPage(normalized);
    await params.onRefreshListingData();
  }

  async changePageSize(params: ChangePageSizeParams): Promise<void> {
    if (!Number.isFinite(params.pageSize) || params.pageSize < 1) {
      return;
    }

    const current = params.getPagination();
    const normalized = Math.floor(params.pageSize);
    if (current.pageSize === normalized) {
      return;
    }

    params.setPagination({
      ...current,
      page: 1,
      pageSize: normalized
    });
    await this.listingDataCoordinatorService.saveLanguagePreference(
      params.http,
      params.isAuthenticated(),
      params.getFilters(),
      params.getSortCriteria(),
      normalized,
      params.getSelectedLanguage()
    );
    await params.onRefreshListingData();
  }

  async loadUserPreferences(params: LoadUserPreferencesParams): Promise<void> {
    this.persistFilteredTotalElementsInSession(0, params.setFilteredTotalElements);
    await this.listingDataCoordinatorService.loadUserPreferences({
      http: params.http,
      setSelectedLanguage: params.setSelectedLanguage,
      persistSelectedLanguage: params.persistSelectedLanguage,
      setFilters: params.setFilters,
      setSortCriteria: params.setSortCriteria,
      setPageSize: params.setPageSize,
      setPropertyLabels: params.setPropertyLabels
    });
  }

  private resolveRequestPageSize(currentPageSize: number): number {
    if (!Number.isFinite(currentPageSize) || currentPageSize <= 0) {
      return DASHBOARD_PAGE_SIZE_OPTIONS[0];
    }

    return Math.floor(currentPageSize);
  }
}
