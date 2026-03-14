import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DashboardDataService } from 'src/app/dashboard/dashboard-data.service';
import { DashboardFiltersState } from 'src/app/dashboard/filters/dashboard-filters.model';
import { DashboardUserPreferencesService } from 'src/app/dashboard/filters/dashboard-user-preferences.service';
import { DashboardPropertyRow, PropertyLabelEntry, SortCriterion, SortToggleRequest } from 'src/app/dashboard/dashboard.types';
import { MaintenanceOperationRunnerService } from 'src/app/dashboard/services/maintenance-operation-runner.service';
import { SortCriteriaService } from 'src/app/dashboard/services/sort-criteria.service';
import { DatabaseMaintenanceOperation } from 'src/app/databasemaintenance/database-maintenance-operation';
import { SupportedLanguage } from 'src/app/i18n/i18n.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardStateFacadeService {
  constructor(
    private readonly dashboardDataService: DashboardDataService,
    private readonly dashboardUserPreferencesService: DashboardUserPreferencesService,
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

  async loadBackendConfiguration(http: HttpClient): Promise<{ backendBaseUrl: string; staticMediaBaseUrl: string }> {
    return this.dashboardDataService.loadBackendConfiguration(http);
  }

  async refreshDashboardData(
    http: HttpClient,
    sortCriteria: SortCriterion[],
    filters: DashboardFiltersState
  ): Promise<{ count: number; properties: DashboardPropertyRow[] }> {
    return this.dashboardDataService.loadDashboardData(http, sortCriteria, filters);
  }

  areFiltersChanged(current: DashboardFiltersState, next: DashboardFiltersState): boolean {
    return current.showClosed !== next.showClosed
      || current.showNew !== next.showNew
      || current.showFavourite !== next.showFavourite
      || current.showRejected !== next.showRejected
      || current.minPublicationDate !== next.minPublicationDate
      || current.maxPublicationDate !== next.maxPublicationDate;
  }

  async saveFiltersPreference(http: HttpClient, filters: DashboardFiltersState): Promise<void> {
    await this.dashboardUserPreferencesService.saveFilters(http, filters);
  }

  async loadUserPreferences(http: HttpClient): Promise<{ filters: DashboardFiltersState; propertyLabels: PropertyLabelEntry[] } | null> {
    return this.dashboardUserPreferencesService.loadPreferences(http);
  }

  toggleSortCriteria(
    currentSortCriteria: SortCriterion[],
    sortBy: SortToggleRequest['sortBy']
  ): SortCriterion[] {
    return this.sortCriteriaService.cycleSortCriteria(currentSortCriteria, sortBy);
  }

  async runMaintenanceOperation(
    operation: DatabaseMaintenanceOperation,
    http: HttpClient
  ): Promise<string> {
    return this.maintenanceOperationRunnerService.runOperation(operation, http);
  }
}
