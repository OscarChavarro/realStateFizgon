import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthUserListItem } from 'src/app/dashboard/auth/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { DashboardTab } from 'src/app/dashboard/dashboard.types';
import { DashboardSessionCoordinatorService } from 'src/app/dashboard/shell/services/dashboard-session-coordinator.service';

type LogoutCurrentUserParams = {
  http: HttpClient;
  getActiveTab: () => DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
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

type DeleteUserAndRefreshParams = {
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
export class UserSessionManagementUseCaseService {
  constructor(
    private readonly dashboardSessionCoordinatorService: DashboardSessionCoordinatorService
  ) {}

  async logoutCurrentUser(params: LogoutCurrentUserParams): Promise<void> {
    await this.dashboardSessionCoordinatorService.logoutAndReset({
      http: params.http,
      setAuthenticatedUser: params.setAuthenticatedUser,
      onResetGuestState: () => {
        params.onResetGuestState();
        if (params.getActiveTab() === 'USERS_TAB' || params.getActiveTab() === 'DATABASE_MAINTENANCE_TAB') {
          params.setActiveTab('DASHBOARD');
        }
      },
      onRefreshDashboardData: params.onRefreshDashboardData
    });
  }

  async loadUsers(params: LoadUsersParams): Promise<void> {
    await this.dashboardSessionCoordinatorService.loadUsers(params);
  }

  async deleteUserAndRefresh(params: DeleteUserAndRefreshParams): Promise<void> {
    await this.dashboardSessionCoordinatorService.deleteUserAndRefresh(params);
  }
}
