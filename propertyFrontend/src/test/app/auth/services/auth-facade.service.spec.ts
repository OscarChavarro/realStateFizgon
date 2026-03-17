import { HttpClient } from '@angular/common/http';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';

class AuthFacadeServiceMockFactory {
  static createHttpClientMock() {
    return {} as HttpClient;
  }

  static createSessionApiMock() {
    return {
      loadGoogleLoginAvailability: jasmine
        .createSpy('loadGoogleLoginAvailability')
        .and.resolveTo(true),
      buildGoogleLoginUrl: jasmine
        .createSpy('buildGoogleLoginUrl')
        .and.returnValue('http://backend/auth/google/login?returnTo=x'),
      loadCurrentUser: jasmine.createSpy('loadCurrentUser').and.resolveTo(null),
      logout: jasmine.createSpy('logout').and.resolveTo(undefined)
    };
  }

  static createUsersApiMock() {
    return {
      loadUsers: jasmine.createSpy('loadUsers').and.resolveTo([]),
      deleteUser: jasmine.createSpy('deleteUser').and.resolveTo(true)
    };
  }

  static createRuntimeConfigMock(baseUrl = 'http://localhost:8081') {
    return {
      getBackendBaseUrl: jasmine.createSpy('getBackendBaseUrl').and.returnValue(baseUrl)
    };
  }

  static createAuthenticatedUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
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

  static createManagedUser(overrides: Partial<AuthUserListItem> = {}): AuthUserListItem {
    return {
      id: 'managed-1',
      email: 'managed@example.com',
      name: 'Managed',
      roles: ['STANDARD_USER'],
      permissions: [],
      createdAt: '2026-03-01T00:00:00.000Z',
      lastLoginAt: '2026-03-10T00:00:00.000Z',
      ...overrides
    };
  }
}

describe('AuthFacadeService', () => {
  it('should delegate session and user operations to inner services', async () => {
    // Arrange
    const sessionApi = AuthFacadeServiceMockFactory.createSessionApiMock();
    const usersApi = AuthFacadeServiceMockFactory.createUsersApiMock();
    const runtimeConfig = AuthFacadeServiceMockFactory.createRuntimeConfigMock();
    const facade = new AuthFacadeService(sessionApi as any, usersApi as any, runtimeConfig as any);
    const http = AuthFacadeServiceMockFactory.createHttpClientMock();
    const authUser = AuthFacadeServiceMockFactory.createAuthenticatedUser();
    const managedUsers = [AuthFacadeServiceMockFactory.createManagedUser()];
    sessionApi.loadCurrentUser.and.resolveTo(authUser);
    usersApi.loadUsers.and.resolveTo(managedUsers);
    usersApi.deleteUser.and.resolveTo(false);

    // Action
    const googleAvailability = await facade.loadGoogleLoginAvailability(http);
    const loginUrl = facade.buildGoogleLoginUrl('http://localhost:4200');
    const currentUser = await facade.loadCurrentUser(http);
    await facade.logout(http);
    const users = await facade.loadUsers(http);
    const deleted = await facade.deleteUser(http, 'managed-1');

    // Assert
    expect(sessionApi.loadGoogleLoginAvailability).toHaveBeenCalledOnceWith(http);
    expect(sessionApi.buildGoogleLoginUrl).toHaveBeenCalledOnceWith('http://localhost:4200');
    expect(sessionApi.loadCurrentUser).toHaveBeenCalledOnceWith(http);
    expect(sessionApi.logout).toHaveBeenCalledOnceWith(http);
    expect(usersApi.loadUsers).toHaveBeenCalledOnceWith(http);
    expect(usersApi.deleteUser).toHaveBeenCalledOnceWith(http, 'managed-1');
    expect(googleAvailability).toBeTrue();
    expect(loginUrl).toBe('http://backend/auth/google/login?returnTo=x');
    expect(currentUser).toEqual(authUser);
    expect(users).toEqual(managedUsers);
    expect(deleted).toBeFalse();
  });

  [
    {
      backendBaseUrl: 'http://localhost:8081',
      frontendHost: 'localhost',
      shouldWarn: false
    },
    {
      backendBaseUrl: 'http://api.internal:8081',
      frontendHost: 'localhost',
      shouldWarn: true
    }
  ].forEach(({ backendBaseUrl, frontendHost, shouldWarn }) => {
    it(`warnIfAuthHostMismatch should ${shouldWarn ? '' : 'not '}warn for backend "${backendBaseUrl}" and frontend "${frontendHost}"`, () => {
      // Arrange
      const sessionApi = AuthFacadeServiceMockFactory.createSessionApiMock();
      const usersApi = AuthFacadeServiceMockFactory.createUsersApiMock();
      const runtimeConfig = AuthFacadeServiceMockFactory.createRuntimeConfigMock(backendBaseUrl);
      const facade = new AuthFacadeService(
        sessionApi as any,
        usersApi as any,
        runtimeConfig as any
      );
      const warnSpy = spyOn(console, 'warn');

      // Action
      facade.warnIfAuthHostMismatch(frontendHost);

      // Assert
      if (shouldWarn) {
        expect(warnSpy).toHaveBeenCalledTimes(1);
      } else {
        expect(warnSpy).not.toHaveBeenCalled();
      }
    });
  });

  it('warnIfAuthHostMismatch should notify when URL parsing fails', () => {
    // Arrange
    const sessionApi = AuthFacadeServiceMockFactory.createSessionApiMock();
    const usersApi = AuthFacadeServiceMockFactory.createUsersApiMock();
    const runtimeConfig = AuthFacadeServiceMockFactory.createRuntimeConfigMock('::not-a-url::');
    const facade = new AuthFacadeService(sessionApi as any, usersApi as any, runtimeConfig as any);
    const warnSpy = spyOn(console, 'warn');

    // Action
    facade.warnIfAuthHostMismatch('localhost');

    // Assert
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.calls.mostRecent().args[0]).toContain('auth.warnIfAuthHostMismatch');
  });
});
