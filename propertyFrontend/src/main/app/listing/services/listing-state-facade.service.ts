import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ListingDataService } from 'src/app/listing/services/listing-data.service';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import { UserPreferencesService } from 'src/app/prefs/services/user-preferences.service';
import {
  ListingPropertyRow,
  PropertyLabelEntry,
  SortCriterion,
  SortToggleRequest
} from 'src/app/listing/model/listing.types';
import { ListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { MaintenanceOperationRunnerService } from 'src/app/maintenance/services/maintenance-operation-runner.service';
import { SortCriteriaService } from 'src/app/listing/services/sort-criteria.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';

@Injectable({
  providedIn: 'root'
})
export class ListingStateFacadeService {
  constructor(
    private readonly http: HttpClient,
    private readonly listingDataService: ListingDataService,
    private readonly listingUserPreferencesService: UserPreferencesService,
    private readonly sortCriteriaService: SortCriteriaService,
    private readonly maintenanceOperationRunnerService: MaintenanceOperationRunnerService
  ) {}

  loadSelectedLanguageFromSession(selectedLanguageKey: string): SupportedLanguage {
    const savedLanguage = sessionStorage.getItem(selectedLanguageKey);
    if (savedLanguage === 'sp' || savedLanguage === 'en') {
      return savedLanguage;
    }

    sessionStorage.setItem(selectedLanguageKey, 'en');
    return 'en';
  }

  persistSelectedLanguage(selectedLanguageKey: string, language: SupportedLanguage): void {
    sessionStorage.setItem(selectedLanguageKey, language);
  }

  async loadBackendConfiguration(): Promise<{
    backendBaseUrl: string;
    staticMediaBaseUrl: string;
    googleMapsApiKey: string | null;
    googleMapsMapId: string | null;
  }> {
    return this.listingDataService.loadBackendConfiguration(this.http);
  }

  async refreshListingData(
    sortCriteria: SortCriterion[],
    filters: ListingFiltersState,
    page: number,
    pageSize: number
  ): Promise<{
    count: number;
    properties: ListingPropertyRow[];
    pagination: ListingPaginationState;
  }> {
    return this.listingDataService.loadListingData(
      this.http,
      sortCriteria,
      filters,
      page,
      pageSize
    );
  }

  areFiltersChanged(current: ListingFiltersState, next: ListingFiltersState): boolean {
    return (
      current.showClosed !== next.showClosed ||
      current.showNew !== next.showNew ||
      current.showFavourite !== next.showFavourite ||
      current.showRejected !== next.showRejected ||
      current.minPublicationDate !== next.minPublicationDate ||
      current.maxPublicationDate !== next.maxPublicationDate ||
      current.minPrice !== next.minPrice ||
      current.maxPrice !== next.maxPrice
    );
  }

  async saveFiltersPreference(
    filters: ListingFiltersState,
    language: SupportedLanguage,
    sortCriteria: SortCriterion[],
    pageSize: number
  ): Promise<void> {
    await this.listingUserPreferencesService.saveFilters(
      filters,
      language,
      sortCriteria,
      pageSize
    );
  }

  async loadUserPreferences(): Promise<{
    language: SupportedLanguage;
    pageSize: number;
    filters: ListingFiltersState;
    sortCriteria: SortCriterion[];
    propertyLabels: PropertyLabelEntry[];
  } | null> {
    return this.listingUserPreferencesService.loadPreferences();
  }

  toggleSortCriteria(
    currentSortCriteria: SortCriterion[],
    sortBy: SortToggleRequest['sortBy']
  ): SortCriterion[] {
    return this.sortCriteriaService.cycleSortCriteria(currentSortCriteria, sortBy);
  }

  async runMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<string> {
    return this.maintenanceOperationRunnerService.runOperation(operation, this.http);
  }
}
