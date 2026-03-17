import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  ListingPaginationState,
  createDefaultListingPaginationState
} from 'src/app/listing/model/pagination/listing-pagination.model';
import { SortToggleRequest } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

@Injectable({
  providedIn: 'root'
})
export class ListingQueryOrchestratorService {
  private static readonly FILTERED_TOTAL_ELEMENTS_KEY = 'filteredTotalElements';
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';

  constructor(
    private readonly listingDataCoordinatorService: ListingDataCoordinatorService,
    private readonly propertySelectionService: PropertySelectionService,
    private readonly appShellStateService: AppShellStateService
  ) {}

  readFilteredTotalElementsFromSession(): number {
    const raw = sessionStorage.getItem(ListingQueryOrchestratorService.FILTERED_TOTAL_ELEMENTS_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  }

  persistFilteredTotalElementsInSession(totalElements: number): void {
    const normalized =
      Number.isFinite(totalElements) && totalElements >= 0 ? Math.floor(totalElements) : 0;
    this.appShellStateService.filteredTotalElements.set(normalized);
    sessionStorage.setItem(
      ListingQueryOrchestratorService.FILTERED_TOTAL_ELEMENTS_KEY,
      String(normalized)
    );
  }

  async refreshListingData(http: HttpClient): Promise<void> {
    const currentPagination = this.appShellStateService.pagination();
    const requestPageSize = this.resolveRequestPageSize(currentPagination.pageSize);
    const requestPage = requestPageSize > 0 ? currentPagination.page : 1;
    const requestPagination: ListingPaginationState = {
      ...currentPagination,
      page: requestPage,
      pageSize: requestPageSize
    };

    await this.listingDataCoordinatorService.refreshListingData(http, requestPagination, () =>
      this.propertySelectionService.syncAfterRefresh(this.appShellStateService.properties())
    );
    this.persistFilteredTotalElementsInSession(
      this.appShellStateService.pagination().totalElements
    );
  }

  async handleFiltersChange(http: HttpClient, nextFilters: ListingFiltersState): Promise<void> {
    const changed = await this.listingDataCoordinatorService.handleFiltersChange(http, nextFilters);
    if (!changed) {
      return;
    }

    await this.refreshListingData(http);
  }

  async toggleSort(http: HttpClient, sortBy: SortToggleRequest['sortBy']): Promise<void> {
    this.appShellStateService.pagination.update((current) => ({
      ...current,
      page: 1
    }));
    await this.listingDataCoordinatorService.toggleSortAndRefresh(http, sortBy);
    await this.refreshListingData(http);
  }

  async changePage(http: HttpClient, page: number): Promise<void> {
    const current = this.appShellStateService.pagination();
    const totalPages = current.totalPages;
    let normalized = Number.isFinite(page) ? Math.floor(page) : current.page;
    if (normalized < 1) {
      normalized = 1;
    }
    if (totalPages > 0 && normalized > totalPages) {
      normalized = totalPages;
    }
    if (normalized === current.page) {
      return;
    }

    this.appShellStateService.pagination.update((state) => ({
      ...state,
      page: normalized
    }));
    await this.refreshListingData(http);
  }

  async changePageSize(http: HttpClient, pageSize: number): Promise<void> {
    if (!Number.isFinite(pageSize) || pageSize < 1) {
      return;
    }

    const current = this.appShellStateService.pagination();
    const normalized = Math.floor(pageSize);
    if (current.pageSize === normalized) {
      return;
    }

    this.appShellStateService.pagination.set({
      ...current,
      page: 1,
      pageSize: normalized
    });
    await this.listingDataCoordinatorService.saveLanguagePreference(
      http,
      this.appShellStateService.selectedLanguage()
    );
    await this.refreshListingData(http);
  }

  async loadUserPreferences(http: HttpClient): Promise<void> {
    this.persistFilteredTotalElementsInSession(0);
    await this.listingDataCoordinatorService.loadUserPreferences(
      http,
      ListingQueryOrchestratorService.SELECTED_LANGUAGE_KEY
    );
  }

  resetGuestListingState(): void {
    this.appShellStateService.filters.set(createDefaultListingFilters());
    this.appShellStateService.pagination.set(createDefaultListingPaginationState());
    this.persistFilteredTotalElementsInSession(0);
    this.appShellStateService.sortCriteria.set([]);
    this.appShellStateService.propertyLabels.set([]);
  }

  private resolveRequestPageSize(currentPageSize: number): number {
    if (!Number.isFinite(currentPageSize) || currentPageSize <= 0) {
      return DASHBOARD_PAGE_SIZE_OPTIONS[0];
    }

    return Math.floor(currentPageSize);
  }
}
