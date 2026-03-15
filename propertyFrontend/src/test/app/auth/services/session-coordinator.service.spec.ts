import { HttpClient } from '@angular/common/http';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';

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
  it('loadCurrentUserAndApplyState should reset guest state when user is not authenticated', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const service = new SessionCoordinatorService(authFacade as any);
    const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();
    const setAuthenticatedUserSpy = jasmine.createSpy('setAuthenticatedUser');
    const setActiveTabSpy = jasmine.createSpy('setActiveTab');
    const loadPreferencesSpy = jasmine.createSpy('onLoadUserPreferences').and.resolveTo(undefined);
    const loadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);
    const resetGuestStateSpy = jasmine.createSpy('onResetGuestState');

    // Action
    await service.loadCurrentUserAndApplyState({
      http,
      activeTab: 'USERS_TAB',
      canMaintainDatabase: () => false,
      canEditUsers: () => false,
      setAuthenticatedUser: setAuthenticatedUserSpy,
      setActiveTab: setActiveTabSpy,
      onLoadUserPreferences: loadPreferencesSpy,
      onLoadUsers: loadUsersSpy,
      onResetGuestState: resetGuestStateSpy
    });

    // Assert
    expect(authFacade.loadCurrentUser).toHaveBeenCalledOnceWith(http);
    expect(setAuthenticatedUserSpy).toHaveBeenCalledWith(null);
    expect(resetGuestStateSpy).toHaveBeenCalled();
    expect(setActiveTabSpy).toHaveBeenCalledWith('DASHBOARD');
    expect(loadPreferencesSpy).not.toHaveBeenCalled();
    expect(loadUsersSpy).not.toHaveBeenCalled();
  });

  it('loadCurrentUserAndApplyState should keep dashboard tab when user is not authenticated on dashboard', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const service = new SessionCoordinatorService(authFacade as any);
    const setActiveTabSpy = jasmine.createSpy('setActiveTab');

    // Action
    await service.loadCurrentUserAndApplyState({
      http: SessionCoordinatorServiceMockFactory.createHttpClientMock(),
      activeTab: 'DASHBOARD',
      canMaintainDatabase: () => false,
      canEditUsers: () => false,
      setAuthenticatedUser: jasmine.createSpy('setAuthenticatedUser'),
      setActiveTab: setActiveTabSpy,
      onLoadUserPreferences: jasmine.createSpy('onLoadUserPreferences').and.resolveTo(undefined),
      onLoadUsers: jasmine.createSpy('onLoadUsers').and.resolveTo(undefined),
      onResetGuestState: jasmine.createSpy('onResetGuestState')
    });

    // Assert
    expect(setActiveTabSpy).not.toHaveBeenCalled();
  });

  it('loadCurrentUserAndApplyState should load preferences and enforce permissions for authenticated user', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const user = SessionCoordinatorServiceMockFactory.createUser();
    authFacade.loadCurrentUser.and.resolveTo(user);
    const service = new SessionCoordinatorService(authFacade as any);
    const setActiveTabSpy = jasmine.createSpy('setActiveTab');
    const loadPreferencesSpy = jasmine.createSpy('onLoadUserPreferences').and.resolveTo(undefined);
    const loadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);

    // Action
    await service.loadCurrentUserAndApplyState({
      http: SessionCoordinatorServiceMockFactory.createHttpClientMock(),
      activeTab: 'DATABASE_MAINTENANCE_TAB',
      canMaintainDatabase: () => false,
      canEditUsers: () => false,
      setAuthenticatedUser: jasmine.createSpy('setAuthenticatedUser'),
      setActiveTab: setActiveTabSpy,
      onLoadUserPreferences: loadPreferencesSpy,
      onLoadUsers: loadUsersSpy,
      onResetGuestState: jasmine.createSpy('onResetGuestState')
    });

    // Assert
    expect(loadPreferencesSpy).toHaveBeenCalled();
    expect(setActiveTabSpy).toHaveBeenCalledWith('DASHBOARD');
    expect(loadUsersSpy).not.toHaveBeenCalled();
  });

  it('loadCurrentUserAndApplyState should load users in users tab when user can edit users', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    authFacade.loadCurrentUser.and.resolveTo(SessionCoordinatorServiceMockFactory.createUser());
    const service = new SessionCoordinatorService(authFacade as any);
    const loadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);

    // Action
    await service.loadCurrentUserAndApplyState({
      http: SessionCoordinatorServiceMockFactory.createHttpClientMock(),
      activeTab: 'USERS_TAB',
      canMaintainDatabase: () => true,
      canEditUsers: () => true,
      setAuthenticatedUser: jasmine.createSpy('setAuthenticatedUser'),
      setActiveTab: jasmine.createSpy('setActiveTab'),
      onLoadUserPreferences: jasmine.createSpy('onLoadUserPreferences').and.resolveTo(undefined),
      onLoadUsers: loadUsersSpy,
      onResetGuestState: jasmine.createSpy('onResetGuestState')
    });

    // Assert
    expect(loadUsersSpy).toHaveBeenCalled();
  });

  it('logoutAndReset should logout, clear user and refresh data', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const service = new SessionCoordinatorService(authFacade as any);
    const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();
    const setAuthenticatedUserSpy = jasmine.createSpy('setAuthenticatedUser');
    const resetGuestStateSpy = jasmine.createSpy('onResetGuestState');
    const refreshListingSpy = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

    // Action
    await service.logoutAndReset({
      http,
      setAuthenticatedUser: setAuthenticatedUserSpy,
      onResetGuestState: resetGuestStateSpy,
      onRefreshListingData: refreshListingSpy
    });

    // Assert
    expect(authFacade.logout).toHaveBeenCalledOnceWith(http);
    expect(setAuthenticatedUserSpy).toHaveBeenCalledOnceWith(null);
    expect(resetGuestStateSpy).toHaveBeenCalled();
    expect(refreshListingSpy).toHaveBeenCalled();
  });

  it('loadUsers should return empty users list when cannot edit users', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const service = new SessionCoordinatorService(authFacade as any);
    const setUsersSpy = jasmine.createSpy('setUsers');
    const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');

    // Action
    await service.loadUsers({
      http: SessionCoordinatorServiceMockFactory.createHttpClientMock(),
      canEditUsers: false,
      setUsersLoading: setUsersLoadingSpy,
      setUsers: setUsersSpy
    });

    // Assert
    expect(setUsersSpy).toHaveBeenCalledOnceWith([]);
    expect(setUsersLoadingSpy).not.toHaveBeenCalled();
    expect(authFacade.loadUsers).not.toHaveBeenCalled();
  });

  it('loadUsers should fetch users when can edit users', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    const users = [{ id: 'managed-1' }];
    authFacade.loadUsers.and.resolveTo(users);
    const service = new SessionCoordinatorService(authFacade as any);
    const setUsersSpy = jasmine.createSpy('setUsers');
    const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');
    const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();

    // Action
    await service.loadUsers({
      http,
      canEditUsers: true,
      setUsersLoading: setUsersLoadingSpy,
      setUsers: setUsersSpy
    });

    // Assert
    expect(setUsersLoadingSpy.calls.allArgs()).toEqual([[true], [false]]);
    expect(authFacade.loadUsers).toHaveBeenCalledOnceWith(http);
    expect(setUsersSpy).toHaveBeenCalledOnceWith(users);
  });

  [
    { label: 'cannot edit users', canEditUsers: false, userId: 'u1', currentUser: null as AuthenticatedUser | null },
    { label: 'empty user id', canEditUsers: true, userId: '', currentUser: null as AuthenticatedUser | null },
    { label: 'self deletion', canEditUsers: true, userId: 'u1', currentUser: SessionCoordinatorServiceMockFactory.createUser({ id: 'u1' }) }
  ].forEach(({ label, canEditUsers, userId, currentUser }) => {
    it(`deleteUserAndRefresh should return early for ${label}`, async () => {
      // Arrange
      const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
      const service = new SessionCoordinatorService(authFacade as any);
      const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');
      const onLoadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);

      // Action
      await service.deleteUserAndRefresh({
        http: SessionCoordinatorServiceMockFactory.createHttpClientMock(),
        userId,
        canEditUsers,
        currentUser,
        setUsersLoading: setUsersLoadingSpy,
        onLoadUsers: onLoadUsersSpy
      });

      // Assert
      expect(setUsersLoadingSpy).not.toHaveBeenCalled();
      expect(authFacade.deleteUser).not.toHaveBeenCalled();
      expect(onLoadUsersSpy).not.toHaveBeenCalled();
    });
  });

  it('deleteUserAndRefresh should refresh users when deletion succeeds', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    authFacade.deleteUser.and.resolveTo(true);
    const service = new SessionCoordinatorService(authFacade as any);
    const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');
    const onLoadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);
    const http = SessionCoordinatorServiceMockFactory.createHttpClientMock();

    // Action
    await service.deleteUserAndRefresh({
      http,
      userId: 'u2',
      canEditUsers: true,
      currentUser: SessionCoordinatorServiceMockFactory.createUser({ id: 'u1' }),
      setUsersLoading: setUsersLoadingSpy,
      onLoadUsers: onLoadUsersSpy
    });

    // Assert
    expect(setUsersLoadingSpy).toHaveBeenCalledOnceWith(true);
    expect(authFacade.deleteUser).toHaveBeenCalledOnceWith(http, 'u2');
    expect(onLoadUsersSpy).toHaveBeenCalled();
  });

  it('deleteUserAndRefresh should stop loading when deletion fails', async () => {
    // Arrange
    const authFacade = SessionCoordinatorServiceMockFactory.createAuthFacadeMock();
    authFacade.deleteUser.and.resolveTo(false);
    const service = new SessionCoordinatorService(authFacade as any);
    const setUsersLoadingSpy = jasmine.createSpy('setUsersLoading');
    const onLoadUsersSpy = jasmine.createSpy('onLoadUsers').and.resolveTo(undefined);

    // Action
    await service.deleteUserAndRefresh({
      http: SessionCoordinatorServiceMockFactory.createHttpClientMock(),
      userId: 'u2',
      canEditUsers: true,
      currentUser: SessionCoordinatorServiceMockFactory.createUser({ id: 'u1' }),
      setUsersLoading: setUsersLoadingSpy,
      onLoadUsers: onLoadUsersSpy
    });

    // Assert
    expect(setUsersLoadingSpy.calls.allArgs()).toEqual([[true], [false]]);
    expect(onLoadUsersSpy).not.toHaveBeenCalled();
  });
});
