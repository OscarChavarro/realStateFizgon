import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { AuthSessionApiService } from 'src/app/auth/services/auth-session-api.service';

class AuthSessionApiServiceMockFactory {
  static createHttpClientMock() {
    return {
      get: jasmine.createSpy('get'),
      post: jasmine.createSpy('post')
    } as unknown as HttpClient;
  }

  static createRuntimeConfigMock(backendBaseUrl = 'http://localhost:8081') {
    return {
      getBackendBaseUrl: jasmine.createSpy('getBackendBaseUrl').and.returnValue(backendBaseUrl)
    } as any;
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

describe('AuthSessionApiService', () => {
  it('loadGoogleLoginAvailability should return true only when response enabled is true', async () => {
    // Arrange
    const http = AuthSessionApiServiceMockFactory.createHttpClientMock();
    const runtimeConfig = AuthSessionApiServiceMockFactory.createRuntimeConfigMock();
    const service = new AuthSessionApiService(runtimeConfig);

    // Action
    (http.get as jasmine.Spy).and.returnValue(of({ enabled: true }));
    const enabledTrue = await service.loadGoogleLoginAvailability(http);
    (http.get as jasmine.Spy).and.returnValue(of({ enabled: false }));
    const enabledFalse = await service.loadGoogleLoginAvailability(http);
    (http.get as jasmine.Spy).and.returnValue(of({}));
    const enabledMissing = await service.loadGoogleLoginAvailability(http);

    // Assert
    expect((http.get as jasmine.Spy).calls.allArgs()).toEqual([
      ['/auth/google/login-url'],
      ['/auth/google/login-url'],
      ['/auth/google/login-url']
    ]);
    expect(enabledTrue).toBeTrue();
    expect(enabledFalse).toBeFalse();
    expect(enabledMissing).toBeFalse();
  });

  it('loadGoogleLoginAvailability should return false on request error', async () => {
    // Arrange
    const http = AuthSessionApiServiceMockFactory.createHttpClientMock();
    const runtimeConfig = AuthSessionApiServiceMockFactory.createRuntimeConfigMock();
    const service = new AuthSessionApiService(runtimeConfig);
    (http.get as jasmine.Spy).and.returnValue(throwError(() => new Error('boom')));

    // Action
    const enabled = await service.loadGoogleLoginAvailability(http);

    // Assert
    expect(enabled).toBeFalse();
  });

  it('loadCurrentUser should return user only when authenticated and user are present', async () => {
    // Arrange
    const http = AuthSessionApiServiceMockFactory.createHttpClientMock();
    const runtimeConfig = AuthSessionApiServiceMockFactory.createRuntimeConfigMock();
    const service = new AuthSessionApiService(runtimeConfig);
    const user = AuthSessionApiServiceMockFactory.createUser();

    // Action
    (http.get as jasmine.Spy).and.returnValue(of({ authenticated: true, user }));
    const authenticated = await service.loadCurrentUser(http);
    (http.get as jasmine.Spy).and.returnValue(of({ authenticated: false, user }));
    const unauthenticated = await service.loadCurrentUser(http);
    (http.get as jasmine.Spy).and.returnValue(of({ authenticated: true, user: null }));
    const missingUser = await service.loadCurrentUser(http);

    // Assert
    expect((http.get as jasmine.Spy).calls.allArgs()).toEqual([
      ['/auth/google/me'],
      ['/auth/google/me'],
      ['/auth/google/me']
    ]);
    expect(authenticated).toEqual(user);
    expect(unauthenticated).toBeNull();
    expect(missingUser).toBeNull();
  });

  it('loadCurrentUser should return null on request error', async () => {
    // Arrange
    const http = AuthSessionApiServiceMockFactory.createHttpClientMock();
    const runtimeConfig = AuthSessionApiServiceMockFactory.createRuntimeConfigMock();
    const service = new AuthSessionApiService(runtimeConfig);
    (http.get as jasmine.Spy).and.returnValue(throwError(() => new Error('boom')));

    // Action
    const user = await service.loadCurrentUser(http);

    // Assert
    expect(user).toBeNull();
  });

  it('logout should post to logout endpoint and ignore errors', async () => {
    // Arrange
    const http = AuthSessionApiServiceMockFactory.createHttpClientMock();
    const runtimeConfig = AuthSessionApiServiceMockFactory.createRuntimeConfigMock();
    const service = new AuthSessionApiService(runtimeConfig);

    // Action
    (http.post as jasmine.Spy).and.returnValue(of({}));
    await service.logout(http);
    (http.post as jasmine.Spy).and.returnValue(throwError(() => new Error('boom')));
    await service.logout(http);

    // Assert
    expect((http.post as jasmine.Spy).calls.allArgs()).toEqual([
      ['/auth/google/logout', {}],
      ['/auth/google/logout', {}]
    ]);
  });

  it('buildGoogleLoginUrl should compose backend URL and encoded returnTo query parameter', () => {
    // Arrange
    const runtimeConfig = AuthSessionApiServiceMockFactory.createRuntimeConfigMock('http://localhost:8081');
    const service = new AuthSessionApiService(runtimeConfig);
    const returnTo = 'http://localhost:4200/?next=/dashboard map';

    // Action
    const url = service.buildGoogleLoginUrl(returnTo);
    const parsed = new URL(url);

    // Assert
    expect(`${parsed.origin}${parsed.pathname}`).toBe('http://localhost:8081/auth/google/login');
    expect(parsed.searchParams.get('returnTo')).toBe(returnTo);
  });
});
