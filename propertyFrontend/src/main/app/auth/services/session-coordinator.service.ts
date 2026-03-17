import { Injectable } from '@angular/core';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

@Injectable({
  providedIn: 'root'
})
export class SessionCoordinatorService {
  constructor(
    private readonly listingAuthFacadeService: AuthFacadeService,
    private readonly listingQueryOrchestratorService: ListingQueryOrchestratorService,
    private readonly appShellStateService: AppShellStateService
  ) {}

  async loadCurrentUserAndApplyState(): Promise<void> {
    const user = await this.listingAuthFacadeService.loadCurrentUser();
    this.appShellStateService.authenticatedUser.set(user);

    if (!user) {
      this.resetGuestState();
      return;
    }

    await this.listingQueryOrchestratorService.loadUserPreferences();

    if (
      this.appShellStateService.activeTab() === 'DATABASE_MAINTENANCE_TAB' &&
      !this.appShellStateService.canMaintainDatabase()
    ) {
      this.appShellStateService.activeTab.set('DASHBOARD');
    }
    if (
      this.appShellStateService.activeTab() === 'USERS_TAB' &&
      this.appShellStateService.canEditUsers()
    ) {
      await this.loadUsers();
    }
  }

  async logoutAndReset(): Promise<void> {
    await this.listingAuthFacadeService.logout();
    this.appShellStateService.authenticatedUser.set(null);
    this.resetGuestState();
    await this.listingQueryOrchestratorService.refreshListingData();
  }

  async loadUsers(): Promise<void> {
    if (!this.appShellStateService.canEditUsers()) {
      this.appShellStateService.users.set([]);
      return;
    }

    this.appShellStateService.usersLoading.set(true);
    const users = await this.listingAuthFacadeService.loadUsers();
    this.appShellStateService.users.set(users);
    this.appShellStateService.usersLoading.set(false);
  }

  async deleteUserAndRefresh(userId: string): Promise<void> {
    if (!this.appShellStateService.canEditUsers() || !userId) {
      return;
    }

    const currentUser = this.appShellStateService.authenticatedUser();
    if (currentUser && currentUser.id === userId) {
      return;
    }

    this.appShellStateService.usersLoading.set(true);
    const deleted = await this.listingAuthFacadeService.deleteUser(userId);
    if (deleted) {
      await this.loadUsers();
      return;
    }

    this.appShellStateService.usersLoading.set(false);
  }

  private resetGuestState(): void {
    this.appShellStateService.users.set([]);
    this.listingQueryOrchestratorService.resetGuestListingState();
    if (
      this.appShellStateService.activeTab() === 'USERS_TAB' ||
      this.appShellStateService.activeTab() === 'DATABASE_MAINTENANCE_TAB'
    ) {
      this.appShellStateService.activeTab.set('DASHBOARD');
    }
  }
}
