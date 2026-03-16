import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import { ListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { SortToggleRequest } from 'src/app/listing/model/listing.types';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

@Injectable({
  providedIn: 'root'
})
export class ListingDataCoordinatorService {
  constructor(
    private readonly listingStateFacadeService: ListingStateFacadeService,
    private readonly appShellStateService: AppShellStateService
  ) {}

  async refreshListingData(
    http: HttpClient,
    pagination: ListingPaginationState,
    onAfterRefresh?: () => void
  ): Promise<void> {
    this.appShellStateService.loading.set(true);
    const listingData = await this.listingStateFacadeService.refreshListingData(
      http,
      this.appShellStateService.sortCriteria(),
      this.appShellStateService.filters(),
      pagination.page,
      pagination.pageSize
    );

    this.appShellStateService.count.set(listingData.count);
    this.appShellStateService.allProperties.set(listingData.properties);
    this.appShellStateService.pagination.set(listingData.pagination);
    onAfterRefresh?.();
    this.appShellStateService.loading.set(false);
  }

  async handleFiltersChange(http: HttpClient, nextFilters: ListingFiltersState): Promise<boolean> {
    const currentFilters = this.appShellStateService.filters();
    this.appShellStateService.filters.set(nextFilters);
    const changed = this.listingStateFacadeService.areFiltersChanged(currentFilters, nextFilters);
    if (!changed) {
      return false;
    }

    this.appShellStateService.pagination.update((current) => ({
      ...current,
      page: 1
    }));

    if (this.appShellStateService.authenticatedUser() !== null) {
      try {
        await this.listingStateFacadeService.saveFiltersPreference(
          http,
          nextFilters,
          this.appShellStateService.selectedLanguage(),
          this.appShellStateService.sortCriteria(),
          this.appShellStateService.pagination().pageSize
        );
      } catch {
        // Ignore persistence errors so filtering still updates UI from backend.
      }
    }

    return true;
  }

  async loadUserPreferences(http: HttpClient, selectedLanguageKey: string): Promise<void> {
    const preferences = await this.listingStateFacadeService.loadUserPreferences(http);
    if (!preferences) {
      this.appShellStateService.filters.set(createDefaultListingFilters());
      this.appShellStateService.sortCriteria.set([]);
      this.appShellStateService.propertyLabels.set([]);
      return;
    }

    this.appShellStateService.selectedLanguage.set(preferences.language);
    this.listingStateFacadeService.persistSelectedLanguage(selectedLanguageKey, preferences.language);
    this.appShellStateService.pagination.update((current) => ({
      ...current,
      pageSize: preferences.pageSize
    }));
    this.appShellStateService.filters.set(preferences.filters);
    this.appShellStateService.sortCriteria.set(preferences.sortCriteria);
    this.appShellStateService.propertyLabels.set(preferences.propertyLabels);
  }

  async saveLanguagePreference(http: HttpClient, selectedLanguage: SupportedLanguage): Promise<void> {
    if (this.appShellStateService.authenticatedUser() === null) {
      return;
    }

    try {
      await this.listingStateFacadeService.saveFiltersPreference(
        http,
        this.appShellStateService.filters(),
        selectedLanguage,
        this.appShellStateService.sortCriteria(),
        this.appShellStateService.pagination().pageSize
      );
    } catch {
      // Ignore persistence errors so language still updates locally.
    }
  }

  async toggleSortAndRefresh(http: HttpClient, sortBy: SortToggleRequest['sortBy']): Promise<void> {
    const updatedSortCriteria = this.listingStateFacadeService.toggleSortCriteria(
      this.appShellStateService.sortCriteria(),
      sortBy
    );
    this.appShellStateService.sortCriteria.set(updatedSortCriteria);
    if (this.appShellStateService.authenticatedUser() !== null) {
      try {
        await this.listingStateFacadeService.saveFiltersPreference(
          http,
          this.appShellStateService.filters(),
          this.appShellStateService.selectedLanguage(),
          updatedSortCriteria,
          this.appShellStateService.pagination().pageSize
        );
      } catch {
        // Ignore persistence errors so sorting keeps working in current session.
      }
    }
  }

  async runMaintenanceOperation(operation: DatabaseMaintenanceOperation, http: HttpClient): Promise<void> {
    this.appShellStateService.maintenanceRunning.set(true);
    this.appShellStateService.maintenanceResultText.set('');
    const resultText = await this.listingStateFacadeService.runMaintenanceOperation(operation, http);
    this.appShellStateService.maintenanceResultText.set(resultText);
    this.appShellStateService.maintenanceRunning.set(false);
  }
}
