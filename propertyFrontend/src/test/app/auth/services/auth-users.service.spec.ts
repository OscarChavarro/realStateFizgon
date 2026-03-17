import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthUsersService } from 'src/app/auth/services/auth-users.service';
import { RequestErrorPolicyService } from 'src/app/core/errors/services/request-error-policy.service';

class AuthUsersServiceMockFactory {
  static createHttpClientMock() {
    return {
      get: jasmine.createSpy('get'),
      delete: jasmine.createSpy('delete')
    } as unknown as HttpClient;
  }

  static createUser(overrides: Partial<AuthUserListItem> = {}): AuthUserListItem {
    return {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      roles: ['STANDARD_USER'],
      permissions: [],
      createdAt: '2026-03-01T00:00:00.000Z',
      lastLoginAt: '2026-03-10T00:00:00.000Z',
      ...overrides
    };
  }
}

describe('AuthUsersService', () => {
  it('loadUsers should return users when response contains an array', async () => {
    // Arrange
    const http = AuthUsersServiceMockFactory.createHttpClientMock();
    const service = new AuthUsersService(http, new RequestErrorPolicyService());
    const users = [AuthUsersServiceMockFactory.createUser()];
    (http.get as jasmine.Spy).and.returnValue(of({ users }));

    // Action
    const result = await service.loadUsers();

    // Assert
    expect(http.get).toHaveBeenCalledOnceWith('/auth/users');
    expect(result).toEqual(users);
  });

  [
    { response: {}, label: 'missing users field' },
    { response: { users: null }, label: 'null users field' },
    { response: { users: {} }, label: 'non-array users field' }
  ].forEach(({ response, label }) => {
    it(`loadUsers should return empty array for ${label}`, async () => {
      // Arrange
      const http = AuthUsersServiceMockFactory.createHttpClientMock();
      const service = new AuthUsersService(http, new RequestErrorPolicyService());
      (http.get as jasmine.Spy).and.returnValue(of(response));

      // Action
      const result = await service.loadUsers();

      // Assert
      expect(result).toEqual([]);
    });
  });

  it('loadUsers should return empty array on request error', async () => {
    // Arrange
    const http = AuthUsersServiceMockFactory.createHttpClientMock();
    const service = new AuthUsersService(http, new RequestErrorPolicyService());
    (http.get as jasmine.Spy).and.returnValue(throwError(() => new Error('boom')));

    // Action
    const result = await service.loadUsers();

    // Assert
    expect(result).toEqual([]);
  });

  it('deleteUser should call encoded endpoint and return true on success', async () => {
    // Arrange
    const http = AuthUsersServiceMockFactory.createHttpClientMock();
    const service = new AuthUsersService(http, new RequestErrorPolicyService());
    (http.delete as jasmine.Spy).and.returnValue(of({}));

    // Action
    const result = await service.deleteUser('user/with spaces');

    // Assert
    expect(http.delete).toHaveBeenCalledOnceWith('/auth/users/user%2Fwith%20spaces');
    expect(result).toBeTrue();
  });

  it('deleteUser should return false on request error', async () => {
    // Arrange
    const http = AuthUsersServiceMockFactory.createHttpClientMock();
    const service = new AuthUsersService(http, new RequestErrorPolicyService());
    (http.delete as jasmine.Spy).and.returnValue(throwError(() => new Error('boom')));

    // Action
    const result = await service.deleteUser('user-1');

    // Assert
    expect(result).toBeFalse();
  });
});
