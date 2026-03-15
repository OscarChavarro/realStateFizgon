import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { ListingTab } from 'src/app/listing/model/listing.types';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';

type LoadCurrentUserParams = {
  http: HttpClient;
  activeTab: ListingTab;
  canMaintainDatabase: () => boolean;
  canEditUsers: () => boolean;
  setAuthenticatedUser: (user: AuthenticatedUser | null) => void;
  setActiveTab: (tab: ListingTab) => void;
  onLoadUserPreferences: () => Promise<void>;
  onLoadUsers: () => Promise<void>;
  onResetGuestState: () => void;
};

type LogoutParams = {
  http: HttpClient;
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
export class SessionCoordinatorService {
  constructor(
    private readonly listingAuthFacadeService: AuthFacadeService
  ) {}

  async loadCurrentUserAndApplyState(params: LoadCurrentUserParams): Promise<void> {
    const user = await this.listingAuthFacadeService.loadCurrentUser(
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
    await this.listingAuthFacadeService.logout(params.http);
    params.setAuthenticatedUser(null);
    params.onResetGuestState();
    await params.onRefreshListingData();
  }

  async loadUsers(params: LoadUsersParams): Promise<void> {
    if (!params.canEditUsers) {
      params.setUsers([]);
      return;
    }

    params.setUsersLoading(true);
    const users = await this.listingAuthFacadeService.loadUsers(params.http);
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
    const deleted = await this.listingAuthFacadeService.deleteUser(
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
