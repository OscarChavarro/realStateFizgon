import { HttpClient } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
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

  static createAppShellStateMock() {
    const authenticatedUser = signal<AuthenticatedUser | null>(null);
    return {
      authenticatedUser,
      activeTab: signal<'DASHBOARD' | 'MAP_TAB' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB'>(
        'DASHBOARD'
      ),
      selectedLanguage: signal<'en' | 'sp'>('en'),
      usersLoading: signal(false),
      users: signal<AuthUserListItem[]>([]),
      maintenanceRunning: signal(false),
      maintenanceResultText: signal(''),
      canEditUsers: computed(
        () => authenticatedUser()?.permissions?.includes('canEditUsers') === true
      ),
      canMaintainDatabase: computed(
        () => authenticatedUser()?.permissions?.includes('canMaintainDatabase') === true
      ),
      filters: signal(createDefaultListingFilters()),
      sortCriteria: signal([{ sortBy: 'price', sortOrder: 'asc' }] as const),
      pagination: signal({
        page: 1,
        pageSize: 500,
        totalElements: 10,
        totalPages: 1
      })
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
      user: AppShellCommandsUseCaseMockFactory.createUser({
        permissions: ['canEditUsers', 'canMaintainDatabase']
      }),
      expectedTab: 'MAP_TAB',
      shouldLoadUsers: false
    }
  ].forEach(({ tabId, user, expectedTab, shouldLoadUsers }) => {
    it(`whenTabChanges_onTabChange_shouldSet${expectedTab}`, () => {
      // Arrange
      const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
      const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
      const sessionManagement =
        AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
      const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
      appShellState.authenticatedUser.set(user);
      const service = new AppShellCommandsUseCaseService(
        listingStateFacade as unknown as ListingStateFacadeService,
        dataCoordinator as unknown as ListingDataCoordinatorService,
        sessionManagement as unknown as UserSessionManagementUseCaseService,
        appShellState as unknown as AppShellStateService
      );
      const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

      // Action
      service.onTabChange(http, tabId as any);

      // Assert
      expect(appShellState.activeTab()).toBe(expectedTab as any);
      if (shouldLoadUsers) {
        expect(sessionManagement.loadUsers).toHaveBeenCalledOnceWith(http);
      } else {
        expect(sessionManagement.loadUsers).not.toHaveBeenCalled();
      }
    });
  });

  it('whenLanguageChanges_onLanguageChange_shouldPersistAndSavePreference', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onLanguageChange(http, 'sp', 'selected-language');

    // Assert
    expect(appShellState.selectedLanguage()).toBe('sp');
    expect(listingStateFacade.persistSelectedLanguage).toHaveBeenCalledOnceWith(
      'selected-language',
      'sp'
    );
    expect(dataCoordinator.saveLanguagePreference).toHaveBeenCalledOnceWith(http, 'sp');
  });

  it('whenLogoutIsRequested_onLogoutRequested_shouldDelegateToSessionManagement', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onLogoutRequested(http);

    // Assert
    expect(sessionManagement.logoutCurrentUser).toHaveBeenCalledOnceWith(http);
  });

  it('whenDeleteUserIsRequested_onDeleteUserRequested_shouldDelegateToSessionManagement', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onDeleteUserRequested(http, 'user-9');

    // Assert
    expect(sessionManagement.deleteUserAndRefresh).toHaveBeenCalledOnceWith(http, 'user-9');
  });

  it('whenMaintenanceIsRequested_onMaintenanceOperationRequested_shouldDelegateToCoordinator', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      appShellState as unknown as AppShellStateService
    );
    const operation = new RemoveDanglingImagesOperation();
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onMaintenanceOperationRequested(operation, http);

    // Assert
    expect(dataCoordinator.runMaintenanceOperation).toHaveBeenCalledOnceWith(operation, http);
  });

  it('whenLoadingUsersForManagement_loadUsersForManagement_shouldDelegateToSessionManagement', async () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const appShellState = AppShellCommandsUseCaseMockFactory.createAppShellStateMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService,
      appShellState as unknown as AppShellStateService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    await service.loadUsersForManagement(http);

    // Assert
    expect(sessionManagement.loadUsers).toHaveBeenCalledOnceWith(http);
  });
});
