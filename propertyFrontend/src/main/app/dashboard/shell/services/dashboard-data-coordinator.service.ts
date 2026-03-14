import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DashboardPropertyRow, PropertyLabelEntry, SortCriterion, SortToggleRequest } from 'src/app/dashboard/dashboard.types';
import {
  DashboardFiltersState,
  createDefaultDashboardFilters
} from 'src/app/dashboard/filters/dashboard-filters.model';
import { DashboardPaginationState } from 'src/app/dashboard/pagination/dashboard-pagination.model';
import { DashboardStateFacadeService } from 'src/app/dashboard/shell/services/dashboard-state-facade.service';
import { DatabaseMaintenanceOperation } from 'src/app/databasemaintenance/database-maintenance-operation';
import { SupportedLanguage } from 'src/app/i18n/i18n.service';

type RefreshDashboardDataParams = {
  http: HttpClient;
  sortCriteria: SortCriterion[];
  filters: DashboardFiltersState;
  pagination: DashboardPaginationState;
  setLoading: (loading: boolean) => void;
  setCount: (count: number) => void;
  setAllProperties: (properties: DashboardPropertyRow[]) => void;
  setPagination: (pagination: DashboardPaginationState) => void;
  onAfterRefresh: () => void;
};

type HandleFiltersChangeParams = {
  http: HttpClient;
  currentFilters: DashboardFiltersState;
  nextFilters: DashboardFiltersState;
  sortCriteria: SortCriterion[];
  pageSize: number;
  selectedLanguage: SupportedLanguage;
  isAuthenticated: boolean;
  setFilters: (filters: DashboardFiltersState) => void;
  onFiltersChanged: () => void;
  onRefreshDashboardData: () => Promise<void>;
};

type LoadUserPreferencesParams = {
  http: HttpClient;
  setFilters: (filters: DashboardFiltersState) => void;
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
  filters: DashboardFiltersState;
  pageSize: number;
  selectedLanguage: SupportedLanguage;
  isAuthenticated: boolean;
  setSortCriteria: (criteria: SortCriterion[]) => void;
  onRefreshDashboardData: () => Promise<void>;
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
export class DashboardDataCoordinatorService {
  constructor(
    private readonly dashboardStateFacadeService: DashboardStateFacadeService
  ) {}

  async refreshDashboardData(params: RefreshDashboardDataParams): Promise<void> {
    params.setLoading(true);
    const dashboardData = await this.dashboardStateFacadeService.refreshDashboardData(
      params.http,
      params.sortCriteria,
      params.filters,
      params.pagination.page,
      params.pagination.pageSize
    );

    params.setCount(dashboardData.count);
    params.setAllProperties(dashboardData.properties);
    params.setPagination(dashboardData.pagination);
    params.onAfterRefresh();
    params.setLoading(false);
  }

  async handleFiltersChange(params: HandleFiltersChangeParams): Promise<void> {
    params.setFilters(params.nextFilters);
    const changed = this.dashboardStateFacadeService.areFiltersChanged(
      params.currentFilters,
      params.nextFilters
    );
    if (!changed) {
      return;
    }
    params.onFiltersChanged();

    if (params.isAuthenticated) {
      try {
        await this.dashboardStateFacadeService.saveFiltersPreference(
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

    await params.onRefreshDashboardData();
  }

  async loadUserPreferences(params: LoadUserPreferencesParams): Promise<void> {
    const preferences = await this.dashboardStateFacadeService.loadUserPreferences(params.http);
    if (!preferences) {
      params.setFilters(createDefaultDashboardFilters());
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
    filters: DashboardFiltersState,
    sortCriteria: SortCriterion[],
    pageSize: number,
    selectedLanguage: SupportedLanguage
  ): Promise<void> {
    if (!isAuthenticated) {
      return;
    }

    try {
      await this.dashboardStateFacadeService.saveFiltersPreference(
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
    const updatedSortCriteria = this.dashboardStateFacadeService.toggleSortCriteria(
      params.currentSortCriteria,
      params.sortBy
    );
    params.setSortCriteria(updatedSortCriteria);
    if (params.isAuthenticated) {
      try {
        await this.dashboardStateFacadeService.saveFiltersPreference(
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
    await params.onRefreshDashboardData();
  }

  async runMaintenanceOperation(params: MaintenanceOperationParams): Promise<void> {
    params.setMaintenanceRunning(true);
    params.setMaintenanceResultText('');
    const resultText = await this.dashboardStateFacadeService.runMaintenanceOperation(
      params.operation,
      params.http
    );
    params.setMaintenanceResultText(resultText);
    params.setMaintenanceRunning(false);
  }
}
