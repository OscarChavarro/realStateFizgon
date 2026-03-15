import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ListingPropertyRow, PropertyLabelEntry, SortCriterion, SortToggleRequest } from 'src/app/listing/model/listing.types';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import { ListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';

type RefreshListingDataParams = {
  http: HttpClient;
  sortCriteria: SortCriterion[];
  filters: ListingFiltersState;
  pagination: ListingPaginationState;
  setLoading: (loading: boolean) => void;
  setCount: (count: number) => void;
  setAllProperties: (properties: ListingPropertyRow[]) => void;
  setPagination: (pagination: ListingPaginationState) => void;
  onAfterRefresh: () => void;
};

type HandleFiltersChangeParams = {
  http: HttpClient;
  currentFilters: ListingFiltersState;
  nextFilters: ListingFiltersState;
  sortCriteria: SortCriterion[];
  pageSize: number;
  selectedLanguage: SupportedLanguage;
  isAuthenticated: boolean;
  setFilters: (filters: ListingFiltersState) => void;
  onFiltersChanged: () => void;
  onRefreshListingData: () => Promise<void>;
};

type LoadUserPreferencesParams = {
  http: HttpClient;
  setFilters: (filters: ListingFiltersState) => void;
  setSortCriteria: (criteria: SortCriterion[]) => void;
  setPageSize: (pageSize: number) => void;
  setSelectedLanguage: (language: SupportedLanguage) => void;
  persistSelectedLanguage: (language: SupportedLanguage) => void;
  setPropertyLabels: (entries: PropertyLabelEntry[]) => void;
};

type ToggleSortParams = {
  http: HttpClient;
  currentSortCriteria: SortCriterion[];
  sortBy: SortToggleRequest['sortBy'];
  filters: ListingFiltersState;
  pageSize: number;
  selectedLanguage: SupportedLanguage;
  isAuthenticated: boolean;
  setSortCriteria: (criteria: SortCriterion[]) => void;
  onRefreshListingData: () => Promise<void>;
};

type MaintenanceOperationParams = {
  operation: DatabaseMaintenanceOperation;
  http: HttpClient;
  setMaintenanceRunning: (running: boolean) => void;
  setMaintenanceResultText: (text: string) => void;
};

@Injectable({
  providedIn: 'root'
})
export class ListingDataCoordinatorService {
  constructor(
    private readonly listingStateFacadeService: ListingStateFacadeService
  ) {}

  async refreshListingData(params: RefreshListingDataParams): Promise<void> {
    params.setLoading(true);
    const listingData = await this.listingStateFacadeService.refreshListingData(
      params.http,
      params.sortCriteria,
      params.filters,
      params.pagination.page,
      params.pagination.pageSize
    );

    params.setCount(listingData.count);
    params.setAllProperties(listingData.properties);
    params.setPagination(listingData.pagination);
    params.onAfterRefresh();
    params.setLoading(false);
  }

  async handleFiltersChange(params: HandleFiltersChangeParams): Promise<void> {
    params.setFilters(params.nextFilters);
    const changed = this.listingStateFacadeService.areFiltersChanged(
      params.currentFilters,
      params.nextFilters
    );
    if (!changed) {
      return;
    }
    params.onFiltersChanged();

    if (params.isAuthenticated) {
      try {
        await this.listingStateFacadeService.saveFiltersPreference(
          params.http,
          params.nextFilters,
          params.selectedLanguage,
          params.sortCriteria,
          params.pageSize
        );
      } catch {
        // Ignore persistence errors so filtering still updates UI from backend.
      }
    }

    await params.onRefreshListingData();
  }

  async loadUserPreferences(params: LoadUserPreferencesParams): Promise<void> {
    const preferences = await this.listingStateFacadeService.loadUserPreferences(params.http);
    if (!preferences) {
      params.setFilters(createDefaultListingFilters());
      params.setSortCriteria([]);
      params.setPropertyLabels([]);
      return;
    }

    params.setSelectedLanguage(preferences.language);
    params.persistSelectedLanguage(preferences.language);
    params.setPageSize(preferences.pageSize);
    params.setFilters(preferences.filters);
    params.setSortCriteria(preferences.sortCriteria);
    params.setPropertyLabels(preferences.propertyLabels);
  }

  async saveLanguagePreference(
    http: HttpClient,
    isAuthenticated: boolean,
    filters: ListingFiltersState,
    sortCriteria: SortCriterion[],
    pageSize: number,
    selectedLanguage: SupportedLanguage
  ): Promise<void> {
    if (!isAuthenticated) {
      return;
    }

    try {
      await this.listingStateFacadeService.saveFiltersPreference(
        http,
        filters,
        selectedLanguage,
        sortCriteria,
        pageSize
      );
    } catch {
      // Ignore persistence errors so language still updates locally.
    }
  }

  async toggleSortAndRefresh(params: ToggleSortParams): Promise<void> {
    const updatedSortCriteria = this.listingStateFacadeService.toggleSortCriteria(
      params.currentSortCriteria,
      params.sortBy
    );
    params.setSortCriteria(updatedSortCriteria);
    if (params.isAuthenticated) {
      try {
        await this.listingStateFacadeService.saveFiltersPreference(
          params.http,
          params.filters,
          params.selectedLanguage,
          updatedSortCriteria,
          params.pageSize
        );
      } catch {
        // Ignore persistence errors so sorting keeps working in current session.
      }
    }
    await params.onRefreshListingData();
  }

  async runMaintenanceOperation(params: MaintenanceOperationParams): Promise<void> {
    params.setMaintenanceRunning(true);
    params.setMaintenanceResultText('');
    const resultText = await this.listingStateFacadeService.runMaintenanceOperation(
      params.operation,
      params.http
    );
    params.setMaintenanceResultText(resultText);
    params.setMaintenanceRunning(false);
  }
}
