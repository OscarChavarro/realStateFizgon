import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { ListingTab } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

@Injectable({
  providedIn: 'root'
})
export class AppShellCommandsUseCaseService {
  constructor(
    private readonly listingStateFacadeService: ListingStateFacadeService,
    private readonly listingDataCoordinatorService: ListingDataCoordinatorService,
    private readonly userSessionManagementUseCaseService: UserSessionManagementUseCaseService,
    private readonly listingQueryOrchestratorService: ListingQueryOrchestratorService,
    private readonly appShellStateService: AppShellStateService
  ) {}

  onTabChange(http: HttpClient, tabId: ListingTab): void {
    if (tabId === 'USERS_TAB' && !this.appShellStateService.canEditUsers()) {
      this.appShellStateService.activeTab.set('DASHBOARD');
      return;
    }
    if (tabId === 'DATABASE_MAINTENANCE_TAB' && !this.appShellStateService.canMaintainDatabase()) {
      this.appShellStateService.activeTab.set('DASHBOARD');
      return;
    }

    this.appShellStateService.activeTab.set(tabId);
    if (tabId === 'USERS_TAB') {
      void this.loadUsersForManagement(http);
    }
  }

  onLanguageChange(http: HttpClient, language: SupportedLanguage, selectedLanguageKey: string): void {
    this.appShellStateService.selectedLanguage.set(language);
    this.listingStateFacadeService.persistSelectedLanguage(selectedLanguageKey, language);
    void this.listingDataCoordinatorService.saveLanguagePreference(
      http,
      this.appShellStateService.authenticatedUser() !== null,
      this.appShellStateService.filters(),
      this.appShellStateService.sortCriteria(),
      this.appShellStateService.pagination().pageSize,
      language
    );
  }

  onLogoutRequested(http: HttpClient): void {
    void this.userSessionManagementUseCaseService.logoutCurrentUser({
      http,
      getActiveTab: () => this.appShellStateService.activeTab(),
      setActiveTab: (tab) => this.appShellStateService.activeTab.set(tab),
      setAuthenticatedUser: (user) => this.appShellStateService.authenticatedUser.set(user),
      onResetGuestState: () => this.resetGuestState(),
      onRefreshListingData: () => this.listingQueryOrchestratorService.refreshListingData(http)
    });
  }

  onDeleteUserRequested(http: HttpClient, userId: string): void {
    void this.userSessionManagementUseCaseService.deleteUserAndRefresh({
      http,
      userId,
      canEditUsers: this.appShellStateService.canEditUsers(),
      currentUser: this.appShellStateService.authenticatedUser(),
      setUsersLoading: (loading) => this.appShellStateService.usersLoading.set(loading),
      onLoadUsers: () => this.loadUsersForManagement(http)
    });
  }

  onMaintenanceOperationRequested(operation: DatabaseMaintenanceOperation, http: HttpClient): void {
    void this.listingDataCoordinatorService.runMaintenanceOperation({
      operation,
      http,
      setMaintenanceRunning: (running) => this.appShellStateService.maintenanceRunning.set(running),
      setMaintenanceResultText: (text) => this.appShellStateService.maintenanceResultText.set(text)
    });
  }

  async loadUsersForManagement(http: HttpClient): Promise<void> {
    await this.userSessionManagementUseCaseService.loadUsers({
      http,
      canEditUsers: this.appShellStateService.canEditUsers(),
      setUsersLoading: (loading) => this.appShellStateService.usersLoading.set(loading),
      setUsers: (users) => this.appShellStateService.users.set(users)
    });
  }

  private resetGuestState(): void {
    this.appShellStateService.users.set([]);
    this.listingQueryOrchestratorService.resetGuestListingState();
  }
}
