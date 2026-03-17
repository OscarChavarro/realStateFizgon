import { HttpClient } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { AuthenticatedUser, UserPermission } from 'src/app/auth/model/authenticated-user.model';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

class SessionCoordinatorServiceMockFactory {
  static createHttpClientMock() {
    return {} as HttpClient;
  }

  static createAuthFacadeMock() {
    return {
      loadCurrentUser: jasmine.createSpy('loadCurrentUser').and.resolveTo(null),
      logout: jasmine.createSpy('logout').and.resolveTo(undefined),
      loadUsers: jasmine.createSpy('loadUsers').and.resolveTo([]),
      deleteUser: jasmine.createSpy('deleteUser').and.resolveTo(false)
    };
  }

  static createListingQueryOrchestratorMock() {
    return {
      loadUserPreferences: jasmine.createSpy('loadUserPreferences').and.resolveTo(undefined),
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo(undefined),
      resetGuestListingState: jasmine.createSpy('resetGuestListingState')
    };
  }

  static createAppShellStateMock() {
    const authenticatedUser = signal<AuthenticatedUser | null>(null);
    return {
      authenticatedUser,
      activeTab: signal<'DASHBOARD' | 'MAP_TAB' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB'>(
        'DASHBOARD'
      ),
      usersLoading: signal(false),
      users: signal<any[]>([]),
      canMaintainDatabase: computed(
        () => authenticatedUser()?.permissions?.includes('canMaintainDatabase') === true
      ),
      canEditUsers: computed(
        () => authenticatedUser()?.permissions?.includes('canEditUsers') === true
      )
    };
  }

  static createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
    return {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      picture: null,
      roles: ['STANDARD_USER'],
      permissions: [],
      ...overrides
    };
  }
}

describe('SessionCoordinatorService', () => {
  it('whenCurrentUserIsMissing_loadCurrentUserAndApplyState_shouldResetGuestState', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const listingQuery = SessionCoordinatorServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = SessionCoordinatorServiceMockFactory.createAppShellStateMock();
    appShellState.activeTab.set('USERS_TAB');
    appShellState.users.set([{ id: 'managed-user-1' }]);
    const service = new SessionCoordinatorService(
      authFacade as any,
      listingQuery as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );

    // Action
    await service.loadCurrentUserAndApplyState(
      SessionCoordinatorServiceMockFactory.createHttpClientMock()
    );

    // Assert
    expect(appShellState.authenticatedUser()).toBeNull();
    expect(appShellState.users()).toEqual([]);
    expect(appShellState.activeTab()).toBe('DASHBOARD');
    expect(listingQuery.resetGuestListingState).toHaveBeenCalledTimes(1);
    expect(listingQuery.loadUserPreferences).not.toHaveBeenCalled();
  });

  it('whenCurrentUserExists_loadCurrentUserAndApplyState_shouldLoadPreferencesAndApplyTabPermissions', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    authFacade.loadCurrentUser.and.resolveTo(
      SessionCoordinatorServiceMockFactory.createUser({ permissions: [] })
    );
    const listingQuery = SessionCoordinatorServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = SessionCoordinatorServiceMockFactory.createAppShellStateMock();
    appShellState.activeTab.set('DATABASE_MAINTENANCE_TAB');
    const service = new SessionCoordinatorService(
      authFacade as any,
      listingQuery as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );

    // Action
    await service.loadCurrentUserAndApplyState(
      SessionCoordinatorServiceMockFactory.createHttpClientMock()
    );

    // Assert
    expect(listingQuery.loadUserPreferences).toHaveBeenCalledTimes(1);
    expect(appShellState.activeTab()).toBe('DASHBOARD');
  });

  it('whenUsersTabAndUserCanEdit_loadCurrentUserAndApplyState_shouldLoadUsers', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    authFacade.loadCurrentUser.and.resolveTo(
      SessionCoordinatorServiceMockFactory.createUser({ permissions: ['canEditUsers'] })
    );
    authFacade.loadUsers.and.resolveTo([{ id: 'managed-user-1' }]);
    const listingQuery = SessionCoordinatorServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = SessionCoordinatorServiceMockFactory.createAppShellStateMock();
    appShellState.activeTab.set('USERS_TAB');
    const service = new SessionCoordinatorService(
      authFacade as any,
      listingQuery as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();

    // Action
    await service.loadCurrentUserAndApplyState(http);

    // Assert
    expect(authFacade.loadUsers).toHaveBeenCalledOnceWith(http);
    expect(appShellState.users()).toEqual([{ id: 'managed-user-1' }]);
    expect(appShellState.usersLoading()).toBeFalse();
  });

  it('whenLoggingOut_logoutAndReset_shouldClearStateAndRefreshListing', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const listingQuery = SessionCoordinatorServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = SessionCoordinatorServiceMockFactory.createAppShellStateMock();
    appShellState.authenticatedUser.set(SessionCoordinatorServiceMockFactory.createUser());
    appShellState.activeTab.set('DATABASE_MAINTENANCE_TAB');
    appShellState.users.set([{ id: 'managed-user-1' }]);
    const service = new SessionCoordinatorService(
      authFacade as any,
      listingQuery as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();

    // Action
    await service.logoutAndReset(http);

    // Assert
    expect(authFacade.logout).toHaveBeenCalledOnceWith(http);
    expect(appShellState.authenticatedUser()).toBeNull();
    expect(appShellState.users()).toEqual([]);
    expect(appShellState.activeTab()).toBe('DASHBOARD');
    expect(listingQuery.resetGuestListingState).toHaveBeenCalledTimes(1);
    expect(listingQuery.refreshListingData).toHaveBeenCalledOnceWith(http);
  });

  [
    {
      label: 'cannot edit users',
      user: SessionCoordinatorServiceMockFactory.createUser({ permissions: [] }),
      expectedUsers: []
    },
    {
      label: 'can edit users',
      user: SessionCoordinatorServiceMockFactory.createUser({ permissions: ['canEditUsers'] }),
      expectedUsers: [{ id: 'managed-user-1' }]
    }
  ].forEach(({ label, user, expectedUsers }) => {
    it(`whenLoadingUsers_loadUsers_shouldHandle${label.replace(/\s/g, '')}`, async () => {
      // Arrange
      const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
      authFacade.loadUsers.and.resolveTo([{ id: 'managed-user-1' }]);
      const listingQuery =
        SessionCoordinatorServiceMockFactory.createListingQueryOrchestratorMock();
      const appShellState = SessionCoordinatorServiceMockFactory.createAppShellStateMock();
      appShellState.authenticatedUser.set(user);
      const service = new SessionCoordinatorService(
        authFacade as any,
        listingQuery as unknown as ListingQueryOrchestratorService,
        appShellState as unknown as AppShellStateService
      );
      const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();

      // Action
      await service.loadUsers(http);

      // Assert
      expect(appShellState.users()).toEqual(expectedUsers as any[]);
      if (user.permissions.includes('canEditUsers')) {
        expect(authFacade.loadUsers).toHaveBeenCalledOnceWith(http);
      } else {
        expect(authFacade.loadUsers).not.toHaveBeenCalled();
      }
    });
  });

  [
    {
      label: 'without permissions',
      permissions: [] as UserPermission[],
      userId: 'u1',
      currentUserId: 'u0',
      shouldDelete: false
    },
    {
      label: 'with empty id',
      permissions: ['canEditUsers'] as UserPermission[],
      userId: '',
      currentUserId: 'u0',
      shouldDelete: false
    },
    {
      label: 'self delete',
      permissions: ['canEditUsers'] as UserPermission[],
      userId: 'u1',
      currentUserId: 'u1',
      shouldDelete: false
    },
    {
      label: 'with valid target',
      permissions: ['canEditUsers'] as UserPermission[],
      userId: 'u2',
      currentUserId: 'u1',
      shouldDelete: true
    }
  ].forEach(({ label, permissions, userId, currentUserId, shouldDelete }) => {
    it(`whenDeletingUser_deleteUserAndRefresh_shouldHandle${label.replace(/\s/g, '')}`, async () => {
      // Arrange
      const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
      authFacade.deleteUser.and.resolveTo(true);
      authFacade.loadUsers.and.resolveTo([{ id: 'managed-user-2' }]);
      const listingQuery =
        SessionCoordinatorServiceMockFactory.createListingQueryOrchestratorMock();
      const appShellState = SessionCoordinatorServiceMockFactory.createAppShellStateMock();
      appShellState.authenticatedUser.set(
        SessionCoordinatorServiceMockFactory.createUser({ id: currentUserId, permissions })
      );
      const service = new SessionCoordinatorService(
        authFacade as any,
        listingQuery as unknown as ListingQueryOrchestratorService,
        appShellState as unknown as AppShellStateService
      );
      const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();

      // Action
      await service.deleteUserAndRefresh(http, userId);

      // Assert
      if (shouldDelete) {
        expect(authFacade.deleteUser).toHaveBeenCalledOnceWith(http, userId);
        expect(authFacade.loadUsers).toHaveBeenCalledOnceWith(http);
        expect(appShellState.users()).toEqual([{ id: 'managed-user-2' }]);
      } else {
        expect(authFacade.deleteUser).not.toHaveBeenCalled();
      }
    });
  });

  it('whenDeleteFails_deleteUserAndRefresh_shouldStopLoading', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    authFacade.deleteUser.and.resolveTo(false);
    const listingQuery = SessionCoordinatorServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = SessionCoordinatorServiceMockFactory.createAppShellStateMock();
    appShellState.authenticatedUser.set(
      SessionCoordinatorServiceMockFactory.createUser({ permissions: ['canEditUsers'] })
    );
    const service = new SessionCoordinatorService(
      authFacade as any,
      listingQuery as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );

    // Action
    await service.deleteUserAndRefresh(
      SessionCoordinatorServiceMockFactory.createHttpClientMock(),
      'u2'
    );

    // Assert
    expect(appShellState.usersLoading()).toBeFalse();
  });
});
