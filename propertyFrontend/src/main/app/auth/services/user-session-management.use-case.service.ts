import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { ListingTab } from 'src/app/listing/model/listing.types';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';

type LogoutCurrentUserParams = {
  http: HttpClient;
  getActiveTab: () => ListingTab;
  setActiveTab: (tab: ListingTab) => void;
  setAuthenticatedUser: (user: AuthenticatedUser | null) => void;
  onResetGuestState: () => void;
  onRefreshListingData: () => Promise<void>;
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
    private readonly listingSessionCoordinatorService: SessionCoordinatorService
  ) {}

  async logoutCurrentUser(params: LogoutCurrentUserParams): Promise<void> {
    await this.listingSessionCoordinatorService.logoutAndReset({
      http: params.http,
      setAuthenticatedUser: params.setAuthenticatedUser,
      onResetGuestState: () => {
        params.onResetGuestState();
        if (params.getActiveTab() === 'USERS_TAB' || params.getActiveTab() === 'DATABASE_MAINTENANCE_TAB') {
          params.setActiveTab('DASHBOARD');
        }
      },
      onRefreshListingData: params.onRefreshListingData
    });
  }

  async loadUsers(params: LoadUsersParams): Promise<void> {
    await this.listingSessionCoordinatorService.loadUsers(params);
  }

  async deleteUserAndRefresh(params: DeleteUserAndRefreshParams): Promise<void> {
    await this.listingSessionCoordinatorService.deleteUserAndRefresh(params);
  }
}
