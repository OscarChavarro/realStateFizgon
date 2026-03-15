import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import { SortCriterion, ListingTab } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';

type TabChangeParams = {
  tabId: ListingTab;
  canEditUsers: boolean;
  canMaintainDatabase: boolean;
  setActiveTab: (tab: ListingTab) => void;
  onLoadUsers: () => Promise<void>;
};

type LanguageChangeParams = {
  http: HttpClient;
  language: SupportedLanguage;
  selectedLanguageKey: string;
  isAuthenticated: boolean;
  filters: ListingFiltersState;
  sortCriteria: SortCriterion[];
  pageSize: number;
  setSelectedLanguage: (language: SupportedLanguage) => void;
};

type LogoutParams = {
  http: HttpClient;
  getActiveTab: () => ListingTab;
  setActiveTab: (tab: ListingTab) => void;
  setAuthenticatedUser: (user: AuthenticatedUser | null) => void;
  onResetGuestState: () => void;
  onRefreshListingData: () => Promise<void>;
};

type DeleteUserParams = {
  http: HttpClient;
  userId: string;
  canEditUsers: boolean;
  currentUser: AuthenticatedUser | null;
  setUsersLoading: (loading: boolean) => void;
  onLoadUsers: () => Promise<void>;
};

type MaintenanceCommandParams = {
  operation: DatabaseMaintenanceOperation;
  http: HttpClient;
  setMaintenanceRunning: (running: boolean) => void;
  setMaintenanceResultText: (text: string) => void;
};

@Injectable({
  providedIn: 'root'
})
export class AppShellCommandsUseCaseService {
  constructor(
    private readonly listingStateFacadeService: ListingStateFacadeService,
    private readonly listingDataCoordinatorService: ListingDataCoordinatorService,
    private readonly userSessionManagementUseCaseService: UserSessionManagementUseCaseService
  ) {}

  onTabChange(params: TabChangeParams): void {
    if (params.tabId === 'USERS_TAB' && !params.canEditUsers) {
      params.setActiveTab('DASHBOARD');
      return;
    }
    if (params.tabId === 'DATABASE_MAINTENANCE_TAB' && !params.canMaintainDatabase) {
      params.setActiveTab('DASHBOARD');
      return;
    }

    params.setActiveTab(params.tabId);
    if (params.tabId === 'USERS_TAB') {
      void params.onLoadUsers();
    }
  }

  onLanguageChange(params: LanguageChangeParams): void {
    params.setSelectedLanguage(params.language);
    this.listingStateFacadeService.persistSelectedLanguage(params.selectedLanguageKey, params.language);
    void this.listingDataCoordinatorService.saveLanguagePreference(
      params.http,
      params.isAuthenticated,
      params.filters,
      params.sortCriteria,
      params.pageSize,
      params.language
    );
  }

  onLogoutRequested(params: LogoutParams): void {
    void this.userSessionManagementUseCaseService.logoutCurrentUser({
      http: params.http,
      getActiveTab: params.getActiveTab,
      setActiveTab: params.setActiveTab,
      setAuthenticatedUser: params.setAuthenticatedUser,
      onResetGuestState: params.onResetGuestState,
      onRefreshListingData: params.onRefreshListingData
    });
  }

  onDeleteUserRequested(params: DeleteUserParams): void {
    void this.userSessionManagementUseCaseService.deleteUserAndRefresh({
      http: params.http,
      userId: params.userId,
      canEditUsers: params.canEditUsers,
      currentUser: params.currentUser,
      setUsersLoading: params.setUsersLoading,
      onLoadUsers: params.onLoadUsers
    });
  }

  onMaintenanceOperationRequested(params: MaintenanceCommandParams): void {
    void this.listingDataCoordinatorService.runMaintenanceOperation({
      operation: params.operation,
      http: params.http,
      setMaintenanceRunning: params.setMaintenanceRunning,
      setMaintenanceResultText: params.setMaintenanceResultText
    });
  }
}
