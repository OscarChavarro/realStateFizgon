import { HttpClient } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';
import { AppShellCommandsUseCaseService } from 'src/app/shell/services/app-shell-commands.use-case.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

class AppShellCommandsUseCaseMockFactory {
  static createListingStateFacadeMock() {
    return {
      persistSelectedLanguage: jasmine.createSpy('persistSelectedLanguage')
    };
  }

  static createListingDataCoordinatorMock() {
    return {
      saveLanguagePreference: jasmine.createSpy('saveLanguagePreference').and.resolveTo(undefined),
      runMaintenanceOperation: jasmine.createSpy('runMaintenanceOperation').and.resolveTo(undefined)
    };
  }

  static createUserSessionManagementMock() {
    return {
      logoutCurrentUser: jasmine.createSpy('logoutCurrentUser').and.resolveTo(undefined),
      loadUsers: jasmine.createSpy('loadUsers').and.resolveTo(undefined),
      deleteUserAndRefresh: jasmine.createSpy('deleteUserAndRefresh').and.resolveTo(undefined)
    };
  }

  static createListingQueryOrchestratorMock() {
    return {
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo(undefined),
      resetGuestListingState: jasmine.createSpy('resetGuestListingState')
    };
  }

  static createAppShellStateMock() {
    const authenticatedUser = signal<AuthenticatedUser | null>(null);
    return {
      authenticatedUser,
      activeTab: signal<'DASHBOARD' | 'MAP_TAB' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB'>('DASHBOARD'),
      selectedLanguage: signal<'en' | 'sp'>('en'),
      filters: signal(createDefaultListingFilters()),
      sortCriteria: signal([{ sortBy: 'price', sortOrder: 'asc' }] as const),
      pagination: signal({
        page: 1,
        pageSize: 500,
        totalElements: 10,
        totalPages: 1
      }),
      usersLoading: signal(false),
      users: signal<AuthUserListItem[]>([]),
      maintenanceRunning: signal(false),
      maintenanceResultText: signal(''),
      canEditUsers: computed(() => authenticatedUser()?.permissions?.includes('canEditUsers') === true),
      canMaintainDatabase: computed(() => authenticatedUser()?.permissions?.includes('canMaintainDatabase') === true)
    };
  }

  static createHttpClientMock(): HttpClient {
    return {} as HttpClient;
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

describe('AppShellCommandsUseCaseService', () => {
  [
    {
      tabId: 'USERS_TAB',
      user: AppShellCommandsUseCaseMockFactory.createUser({ permissions: [] }),
      expectedTab: 'DASHBOARD',
      shouldLoadUsers: false
    },
    {
      tabId: 'DATABASE_MAINTENANCE_TAB',
      user: AppShellCommandsUseCaseMockFactory.createUser({ permissions: [] }),
      expectedTab: 'DASHBOARD',
      shouldLoadUsers: false
    },
    {
      tabId: 'USERS_TAB',
      user: AppShellCommandsUseCaseMockFactory.createUser({ permissions: ['canEditUsers'] }),
      expectedTab: 'USERS_TAB',
      shouldLoadUsers: true
    },
    {
      tabId: 'MAP_TAB',
      user: AppShellCommandsUseCaseMockFactory.createUser({ permissions: ['canEditUsers', 'canMaintainDatabase'] }),
      expectedTab: 'MAP_TAB',
      shouldLoadUsers: false
    }
  ].forEach(({ tabId, user, expectedTab, shouldLoadUsers }) => {
    it(`onTabChange should set ${expectedTab} for requested ${tabId}`, () => {
      // Arrange
      const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
      const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
      const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
      const listingQueryOrchestrator = AppShellCommandsUseCaseMockFactory.createListingQueryOrchestratorMock();
      const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
      appShellState.authenticatedUser.set(user);
      const service = new AppShellCommandsUseCaseService(
        listingStateFacade as unknown as ListingStateFacadeService,
        dataCoordinator as unknown as ListingDataCoordinatorService,
        sessionManagement as unknown as UserSessionManagementUseCaseService,
        listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
        appShellState as unknown as AppShellStateService
      );
      const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

      // Action
      service.onTabChange(http, tabId as any);

      // Assert
      expect(appShellState.activeTab()).toBe(expectedTab as any);
      if (shouldLoadUsers) {
        expect(sessionManagement.loadUsers).toHaveBeenCalledTimes(1);
      } else {
        expect(sessionManagement.loadUsers).not.toHaveBeenCalled();
      }
    });
  });

  it('onLanguageChange should persist language and trigger preference save', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const listingQueryOrchestrator = AppShellCommandsUseCaseMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    appShellState.authenticatedUser.set(AppShellCommandsUseCaseMockFactory.createUser());
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onLanguageChange(http, 'sp', 'selected-language');

    // Assert
    expect(appShellState.selectedLanguage()).toBe('sp');
    expect(listingStateFacade.persistSelectedLanguage).toHaveBeenCalledOnceWith('selected-language', 'sp');
    expect(dataCoordinator.saveLanguagePreference).toHaveBeenCalledOnceWith(
      http,
      true,
      appShellState.filters(),
      appShellState.sortCriteria(),
      appShellState.pagination().pageSize,
      'sp'
    );
  });

  it('onLogoutRequested should delegate to user session management and reset guest state via store', async () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const listingQueryOrchestrator = AppShellCommandsUseCaseMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    appShellState.authenticatedUser.set(AppShellCommandsUseCaseMockFactory.createUser());
    appShellState.activeTab.set('MAP_TAB');
    appShellState.users.set([{ id: 'user-2', email: 'user2@example.com' } as AuthUserListItem]);
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onLogoutRequested(http);
    const params = sessionManagement.logoutCurrentUser.calls.mostRecent().args[0];
    expect(params.getActiveTab()).toBe('MAP_TAB');
    params.setActiveTab('DASHBOARD');
    params.setAuthenticatedUser(null);
    params.onResetGuestState();
    await params.onRefreshListingData();

    // Assert
    expect(appShellState.activeTab()).toBe('DASHBOARD');
    expect(appShellState.authenticatedUser()).toBeNull();
    expect(appShellState.users()).toEqual([]);
    expect(listingQueryOrchestrator.resetGuestListingState).toHaveBeenCalled();
    expect(listingQueryOrchestrator.refreshListingData).toHaveBeenCalledWith(http);
  });

  it('onDeleteUserRequested should delegate to user session management and reload users', async () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const listingQueryOrchestrator = AppShellCommandsUseCaseMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    appShellState.authenticatedUser.set(AppShellCommandsUseCaseMockFactory.createUser({ permissions: ['canEditUsers'] }));
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();
    sessionManagement.loadUsers.and.callFake(async (params: any) => {
      params.setUsersLoading(true);
      params.setUsers([{ id: 'user-3', email: 'user3@example.com' } as AuthUserListItem]);
      params.setUsersLoading(false);
    });

    // Action
    service.onDeleteUserRequested(http, 'user-9');
    const params = sessionManagement.deleteUserAndRefresh.calls.mostRecent().args[0];
    params.setUsersLoading(true);
    await params.onLoadUsers();

    // Assert
    expect(params.userId).toBe('user-9');
    expect(params.canEditUsers).toBeTrue();
    expect(params.currentUser?.id).toBe('user-1');
    expect(appShellState.usersLoading()).toBeFalse();
    expect(appShellState.users()).toEqual([{ id: 'user-3', email: 'user3@example.com' } as AuthUserListItem]);
  });

  it('onMaintenanceOperationRequested should delegate to listing data coordinator with store setters', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const listingQueryOrchestrator = AppShellCommandsUseCaseMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const operation = new RemoveDanglingImagesOperation();
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onMaintenanceOperationRequested(operation, http);
    const params = dataCoordinator.runMaintenanceOperation.calls.mostRecent().args[0];
    params.setMaintenanceRunning(true);
    params.setMaintenanceResultText('done');

    // Assert
    expect(params.operation).toBe(operation);
    expect(params.http).toBe(http);
    expect(appShellState.maintenanceRunning()).toBeTrue();
    expect(appShellState.maintenanceResultText()).toBe('done');
  });

  it('loadUsersForManagement should bridge session loader callbacks to store signals', async () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const listingQueryOrchestrator = AppShellCommandsUseCaseMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    appShellState.authenticatedUser.set(AppShellCommandsUseCaseMockFactory.createUser({ permissions: ['canEditUsers'] }));
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();
    const managedUsers = [{ id: 'user-2', email: 'u2@example.com' } as AuthUserListItem];
    sessionManagement.loadUsers.and.callFake(async (params: any) => {
      params.setUsersLoading(true);
      params.setUsers(managedUsers);
      params.setUsersLoading(false);
    });

    // Action
    await service.loadUsersForManagement(http);

    // Assert
    expect(sessionManagement.loadUsers).toHaveBeenCalled();
    expect(appShellState.usersLoading()).toBeFalse();
    expect(appShellState.users()).toEqual(managedUsers);
  });
});
