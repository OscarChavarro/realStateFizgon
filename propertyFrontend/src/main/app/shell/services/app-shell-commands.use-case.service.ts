import { Injectable } from '@angular/core';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';
import { ListingTab } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
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
    private readonly appShellStateService: AppShellStateService
  ) {}

  onTabChange(tabId: ListingTab): void {
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
      void this.loadUsersForManagement();
    }
  }

  onLanguageChange(language: SupportedLanguage, selectedLanguageKey: string): void {
    this.appShellStateService.selectedLanguage.set(language);
    this.listingStateFacadeService.persistSelectedLanguage(selectedLanguageKey, language);
    void this.listingDataCoordinatorService.saveLanguagePreference(language);
  }

  onLogoutRequested(): void {
    void this.userSessionManagementUseCaseService.logoutCurrentUser();
  }

  onDeleteUserRequested(userId: string): void {
    void this.userSessionManagementUseCaseService.deleteUserAndRefresh(userId);
  }

  onMaintenanceOperationRequested(operation: DatabaseMaintenanceOperation): void {
    void this.listingDataCoordinatorService.runMaintenanceOperation(operation);
  }

  async loadUsersForManagement(): Promise<void> {
    await this.userSessionManagementUseCaseService.loadUsers();
  }
}
