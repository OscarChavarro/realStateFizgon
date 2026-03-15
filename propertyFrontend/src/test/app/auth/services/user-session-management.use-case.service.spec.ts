import { HttpClient } from '@angular/common/http';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';

class UserSessionManagementUseCaseServiceMockFactory {
  static createHttpClientMock(): HttpClient {
    return {} as HttpClient;
  }

  static createSessionCoordinatorMock() {
    return {
      logoutAndReset: jasmine.createSpy('logoutAndReset').and.resolveTo(undefined),
      loadUsers: jasmine.createSpy('loadUsers').and.resolveTo(undefined),
      deleteUserAndRefresh: jasmine.createSpy('deleteUserAndRefresh').and.resolveTo(undefined)
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

describe('UserSessionManagementUseCaseService', () => {
  [
    { tab: 'USERS_TAB', shouldSetDashboard: true },
    { tab: 'DATABASE_MAINTENANCE_TAB', shouldSetDashboard: true },
    { tab: 'DASHBOARD', shouldSetDashboard: false },
    { tab: 'MAP_TAB', shouldSetDashboard: false }
  ].forEach(({ tab, shouldSetDashboard }) => {
    it(`logoutCurrentUser should ${shouldSetDashboard ? '' : 'not '}set dashboard when active tab is ${tab}`, async () => {
      // Arrange
      const coordinator = UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
      coordinator.logoutAndReset.and.callFake(async (params: any) => {
        params.onResetGuestState();
      });
      const service = new UserSessionManagementUseCaseService(coordinator as unknown as SessionCoordinatorService);
      const http = UserSessionManagementUseCaseServiceMockFactory.createHttpClientMock();
      const setActiveTabSpy = jasmine.createSpy('setActiveTab');
      const setAuthenticatedUserSpy = jasmine.createSpy('setAuthenticatedUser');
      const onResetGuestStateSpy = jasmine.createSpy('onResetGuestState');
      const onRefreshListingDataSpy = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

      // Action
      await service.logoutCurrentUser({
        http,
        getActiveTab: () => tab as any,
        setActiveTab: setActiveTabSpy,
        setAuthenticatedUser: setAuthenticatedUserSpy,
        onResetGuestState: onResetGuestStateSpy,
        onRefreshListingData: onRefreshListingDataSpy
      });

      // Assert
      expect(coordinator.logoutAndReset).toHaveBeenCalledTimes(1);
      expect(coordinator.logoutAndReset).toHaveBeenCalledWith({
        http,
        setAuthenticatedUser: setAuthenticatedUserSpy,
        onResetGuestState: jasmine.any(Function),
        onRefreshListingData: onRefreshListingDataSpy
      });
      expect(onResetGuestStateSpy).toHaveBeenCalledTimes(1);
      if (shouldSetDashboard) {
        expect(setActiveTabSpy).toHaveBeenCalledOnceWith('DASHBOARD');
      } else {
        expect(setActiveTabSpy).not.toHaveBeenCalled();
      }
    });
  });

  it('loadUsers should delegate to session coordinator', async () => {
    // Arrange
    const coordinator = UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(coordinator as unknown as SessionCoordinatorService);
    const http = UserSessionManagementUseCaseServiceMockFactory.createHttpClientMock();
    const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');
    const setUsersSpy = jasmine.createSpy('setUsers');

    // Action
    await service.loadUsers({
      http,
      canEditUsers: true,
      setUsersLoading: setUsersLoadingSpy,
      setUsers: setUsersSpy
    });

    // Assert
    expect(coordinator.loadUsers).toHaveBeenCalledOnceWith({
      http,
      canEditUsers: true,
      setUsersLoading: setUsersLoadingSpy,
      setUsers: setUsersSpy
    });
  });

  it('deleteUserAndRefresh should delegate to session coordinator', async () => {
    // Arrange
    const coordinator = UserSessionManagementUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const service = new UserSessionManagementUseCaseService(coordinator as unknown as SessionCoordinatorService);
    const http = UserSessionManagementUseCaseServiceMockFactory.createHttpClientMock();
    const currentUser = UserSessionManagementUseCaseServiceMockFactory.createUser();
    const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');
    const onLoadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);

    // Action
    await service.deleteUserAndRefresh({
      http,
      userId: 'user-2',
      canEditUsers: true,
      currentUser,
      setUsersLoading: setUsersLoadingSpy,
      onLoadUsers: onLoadUsersSpy
    });

    // Assert
    expect(coordinator.deleteUserAndRefresh).toHaveBeenCalledOnceWith({
      http,
      userId: 'user-2',
      canEditUsers: true,
      currentUser,
      setUsersLoading: setUsersLoadingSpy,
      onLoadUsers: onLoadUsersSpy
    });
  });
});
