import { HttpClient } from '@angular/common/http';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { ListingFiltersState, createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { SortCriterion } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';
import { AppShellCommandsUseCaseService } from 'src/app/shell/services/app-shell-commands.use-case.service';

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
      deleteUserAndRefresh: jasmine.createSpy('deleteUserAndRefresh').and.resolveTo(undefined)
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
      canEditUsers: false,
      canMaintainDatabase: true,
      expectedTab: 'DASHBOARD',
      shouldLoadUsers: false
    },
    {
      tabId: 'DATABASE_MAINTENANCE_TAB',
      canEditUsers: true,
      canMaintainDatabase: false,
      expectedTab: 'DASHBOARD',
      shouldLoadUsers: false
    },
    {
      tabId: 'USERS_TAB',
      canEditUsers: true,
      canMaintainDatabase: true,
      expectedTab: 'USERS_TAB',
      shouldLoadUsers: true
    },
    {
      tabId: 'MAP_TAB',
      canEditUsers: true,
      canMaintainDatabase: true,
      expectedTab: 'MAP_TAB',
      shouldLoadUsers: false
    }
  ].forEach(({ tabId, canEditUsers, canMaintainDatabase, expectedTab, shouldLoadUsers }) => {
    it(`onTabChange should set ${expectedTab} for requested ${tabId}`, () => {
      // Arrange
      const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
      const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
      const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
      const service = new AppShellCommandsUseCaseService(
        listingStateFacade as unknown as ListingStateFacadeService,
        dataCoordinator as unknown as ListingDataCoordinatorService,
        sessionManagement as unknown as UserSessionManagementUseCaseService
      );
      const setActiveTabSpy = jasmine.createSpy('setActiveTab');
      const onLoadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);

      // Action
      service.onTabChange({
        tabId: tabId as any,
        canEditUsers,
        canMaintainDatabase,
        setActiveTab: setActiveTabSpy,
        onLoadUsers: onLoadUsersSpy
      });

      // Assert
      expect(setActiveTabSpy).toHaveBeenCalledOnceWith(expectedTab as any);
      if (shouldLoadUsers) {
        expect(onLoadUsersSpy).toHaveBeenCalledTimes(1);
      } else {
        expect(onLoadUsersSpy).not.toHaveBeenCalled();
      }
    });
  });

  it('onLanguageChange should persist language and trigger preference save', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService
    );
    const setSelectedLanguageSpy = jasmine.createSpy('setSelectedLanguage');
    const filters: ListingFiltersState = createDefaultListingFilters();
    const sortCriteria: SortCriterion[] = [{ sortBy: 'title', sortOrder: 'asc' }];
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();

    // Action
    service.onLanguageChange({
      http,
      language: 'sp',
      selectedLanguageKey: 'selected-language',
      isAuthenticated: true,
      filters,
      sortCriteria,
      pageSize: 500,
      setSelectedLanguage: setSelectedLanguageSpy
    });

    // Assert
    expect(setSelectedLanguageSpy).toHaveBeenCalledOnceWith('sp');
    expect(listingStateFacade.persistSelectedLanguage).toHaveBeenCalledOnceWith('selected-language', 'sp');
    expect(dataCoordinator.saveLanguagePreference).toHaveBeenCalledOnceWith(
      http,
      true,
      filters,
      sortCriteria,
      500,
      'sp'
    );
  });

  it('onLogoutRequested should delegate to user session management', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();
    const getActiveTab = () => 'DASHBOARD' as const;
    const setActiveTabSpy = jasmine.createSpy('setActiveTab');
    const setAuthenticatedUserSpy = jasmine.createSpy('setAuthenticatedUser');
    const onResetGuestStateSpy = jasmine.createSpy('onResetGuestState');
    const onRefreshListingDataSpy = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

    // Action
    service.onLogoutRequested({
      http,
      getActiveTab,
      setActiveTab: setActiveTabSpy,
      setAuthenticatedUser: setAuthenticatedUserSpy,
      onResetGuestState: onResetGuestStateSpy,
      onRefreshListingData: onRefreshListingDataSpy
    });

    // Assert
    expect(sessionManagement.logoutCurrentUser).toHaveBeenCalledOnceWith({
      http,
      getActiveTab,
      setActiveTab: setActiveTabSpy,
      setAuthenticatedUser: setAuthenticatedUserSpy,
      onResetGuestState: onResetGuestStateSpy,
      onRefreshListingData: onRefreshListingDataSpy
    });
  });

  it('onDeleteUserRequested should delegate to user session management', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService
    );
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();
    const currentUser = AppShellCommandsUseCaseMockFactory.createUser();
    const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');
    const onLoadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);

    // Action
    service.onDeleteUserRequested({
      http,
      userId: 'user-2',
      canEditUsers: true,
      currentUser,
      setUsersLoading: setUsersLoadingSpy,
      onLoadUsers: onLoadUsersSpy
    });

    // Assert
    expect(sessionManagement.deleteUserAndRefresh).toHaveBeenCalledOnceWith({
      http,
      userId: 'user-2',
      canEditUsers: true,
      currentUser,
      setUsersLoading: setUsersLoadingSpy,
      onLoadUsers: onLoadUsersSpy
    });
  });

  it('onMaintenanceOperationRequested should delegate to listing data coordinator', () => {
    // Arrange
    const listingStateFacade = AppShellCommandsUseCaseMockFactory.createListingStateFacadeMock();
    const dataCoordinator = AppShellCommandsUseCaseMockFactory.createListingDataCoordinatorMock();
    const sessionManagement = AppShellCommandsUseCaseMockFactory.createUserSessionManagementMock();
    const service = new AppShellCommandsUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      dataCoordinator as unknown as ListingDataCoordinatorService,
      sessionManagement as unknown as UserSessionManagementUseCaseService
    );
    const operation = new RemoveDanglingImagesOperation();
    const http = AppShellCommandsUseCaseMockFactory.createHttpClientMock();
    const setMaintenanceRunningSpy = jasmine.createSpy('setMaintenanceRunning');
    const setMaintenanceResultTextSpy = jasmine.createSpy('setMaintenanceResultText');

    // Action
    service.onMaintenanceOperationRequested({
      operation,
      http,
      setMaintenanceRunning: setMaintenanceRunningSpy,
      setMaintenanceResultText: setMaintenanceResultTextSpy
    });

    // Assert
    expect(dataCoordinator.runMaintenanceOperation).toHaveBeenCalledOnceWith({
      operation,
      http,
      setMaintenanceRunning: setMaintenanceRunningSpy,
      setMaintenanceResultText: setMaintenanceResultTextSpy
    });
  });
});
