import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthUserListItem } from 'src/app/dashboard/auth/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { DashboardTab } from 'src/app/dashboard/dashboard.types';
import { DashboardAuthFacadeService } from 'src/app/dashboard/shell/services/dashboard-auth-facade.service';

type LoadCurrentUserParams = {
  http: HttpClient;
  activeTab: DashboardTab;
  canMaintainDatabase: () => boolean;
  canEditUsers: () => boolean;
  setAuthenticatedUser: (user: AuthenticatedUser | null) => void;
  setActiveTab: (tab: DashboardTab) => void;
  onLoadUserPreferences: () => Promise<void>;
  onLoadUsers: () => Promise<void>;
  onResetGuestState: () => void;
};

type LogoutParams = {
  http: HttpClient;
  setAuthenticatedUser: (user: AuthenticatedUser | null) => void;
  onResetGuestState: () => void;
  onRefreshDashboardData: () => Promise<void>;
};

type LoadUsersParams = {
  http: HttpClient;
  canEditUsers: boolean;
  setUsersLoading: (loading: boolean) => void;
  setUsers: (users: AuthUserListItem[]) => void;
};

type DeleteUserParams = {
  http: HttpClient;
  userId: string;
  canEditUsers: boolean;
  currentUser: AuthenticatedUser | null;
  setUsersLoading: (loading: boolean) => void;
  onLoadUsers: () => Promise<void>;
};

@Injectable({
  providedIn: 'root'
})
export class DashboardSessionCoordinatorService {
  constructor(
    private readonly dashboardAuthFacadeService: DashboardAuthFacadeService
  ) {}

  async loadCurrentUserAndApplyState(params: LoadCurrentUserParams): Promise<void> {
    const user = await this.dashboardAuthFacadeService.loadCurrentUser(
      params.http
    );
    params.setAuthenticatedUser(user);

    if (!user) {
      params.onResetGuestState();
      if (params.activeTab === 'USERS_TAB' || params.activeTab === 'DATABASE_MAINTENANCE_TAB') {
        params.setActiveTab('DASHBOARD');
      }
      return;
    }

    await params.onLoadUserPreferences();

    if (params.activeTab === 'DATABASE_MAINTENANCE_TAB' && !params.canMaintainDatabase()) {
      params.setActiveTab('DASHBOARD');
    }
    if (params.activeTab === 'USERS_TAB' && params.canEditUsers()) {
      await params.onLoadUsers();
    }
  }

  async logoutAndReset(params: LogoutParams): Promise<void> {
    await this.dashboardAuthFacadeService.logout(params.http);
    params.setAuthenticatedUser(null);
    params.onResetGuestState();
    await params.onRefreshDashboardData();
  }

  async loadUsers(params: LoadUsersParams): Promise<void> {
    if (!params.canEditUsers) {
      params.setUsers([]);
      return;
    }

    params.setUsersLoading(true);
    const users = await this.dashboardAuthFacadeService.loadUsers(params.http);
    params.setUsers(users);
    params.setUsersLoading(false);
  }

  async deleteUserAndRefresh(params: DeleteUserParams): Promise<void> {
    if (!params.canEditUsers || !params.userId) {
      return;
    }

    if (params.currentUser && params.currentUser.id === params.userId) {
      return;
    }

    params.setUsersLoading(true);
    const deleted = await this.dashboardAuthFacadeService.deleteUser(
      params.http,
      params.userId
    );
    if (deleted) {
      await params.onLoadUsers();
      return;
    }

    params.setUsersLoading(false);
  }
}
