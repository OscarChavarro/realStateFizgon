import { TestBed } from '@angular/core/testing';
import { UsersPanelComponent } from 'src/app/auth/components/users-panel/users-panel.component';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';

class UsersPanelComponentMockFactory {
  static createI18nMock() {
    return {
      get: jasmine.createSpy('get').and.callFake((id: string, language: string) => `${id}:${language}`)
    };
  }

  static createComponent(i18nMock: { get: jasmine.Spy }): UsersPanelComponent {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18nMock }]
    });
    return TestBed.runInInjectionContext(() => new UsersPanelComponent());
  }

  static createUser(overrides: Partial<AuthUserListItem> = {}): AuthUserListItem {
    return {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User Name',
      roles: ['STANDARD_USER'],
      permissions: [],
      createdAt: '2026-03-01T00:00:00.000Z',
      lastLoginAt: '2026-03-10T00:00:00.000Z',
      ...overrides
    };
  }
}

describe('UsersPanelComponent', () => {
  it('onDeleteUser should emit selected user id', () => {
    // Arrange
    const i18nMock = UsersPanelComponentMockFactory.createI18nMock();
    const component = UsersPanelComponentMockFactory.createComponent(i18nMock);
    const emitSpy = spyOn(component.deleteUserRequest, 'emit');

    // Action
    component.onDeleteUser('user-2');

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith('user-2');
  });

  it('t should delegate translation lookup', () => {
    // Arrange
    const i18nMock = UsersPanelComponentMockFactory.createI18nMock();
    const component = UsersPanelComponentMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.t('USERS_TAB');

    // Assert
    expect(i18nMock.get).toHaveBeenCalledOnceWith('USERS_TAB', 'sp');
    expect(result).toBe('USERS_TAB:sp');
  });

  [
    { user: UsersPanelComponentMockFactory.createUser({ name: '  Name  ', email: 'mail@example.com' }), expected: 'Name' },
    { user: UsersPanelComponentMockFactory.createUser({ name: '  ', email: '  mail@example.com  ' }), expected: 'mail@example.com' },
    { user: UsersPanelComponentMockFactory.createUser({ name: ' ', email: ' ' }), expected: '-' },
    { user: UsersPanelComponentMockFactory.createUser({ name: null, email: null }), expected: '-' }
  ].forEach(({ user, expected }) => {
    it(`getDisplayName should return "${expected}"`, () => {
      // Arrange
      const i18nMock = UsersPanelComponentMockFactory.createI18nMock();
      const component = UsersPanelComponentMockFactory.createComponent(i18nMock);

      // Action
      const result = component.getDisplayName(user);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { user: UsersPanelComponentMockFactory.createUser({ roles: ['STANDARD_USER'] }), expected: 'STANDARD_USER' },
    { user: UsersPanelComponentMockFactory.createUser({ roles: ['STANDARD_USER', 'ADMIN'] }), expected: 'STANDARD_USER, ADMIN' },
    { user: UsersPanelComponentMockFactory.createUser({ roles: [] }), expected: 'STANDARD_USER' },
    { user: UsersPanelComponentMockFactory.createUser({ roles: null as unknown as any[] }), expected: 'STANDARD_USER' }
  ].forEach(({ user, expected }) => {
    it(`getDisplayRoles should return "${expected}"`, () => {
      // Arrange
      const i18nMock = UsersPanelComponentMockFactory.createI18nMock();
      const component = UsersPanelComponentMockFactory.createComponent(i18nMock);

      // Action
      const result = component.getDisplayRoles(user);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { user: UsersPanelComponentMockFactory.createUser({ permissions: ['canEditUsers'] }), expected: 'canEditUsers' },
    { user: UsersPanelComponentMockFactory.createUser({ permissions: ['canEditUsers', 'canMaintainDatabase'] }), expected: 'canEditUsers, canMaintainDatabase' },
    { user: UsersPanelComponentMockFactory.createUser({ permissions: [] }), expected: '-' },
    { user: UsersPanelComponentMockFactory.createUser({ permissions: null as unknown as any[] }), expected: '-' }
  ].forEach(({ user, expected }) => {
    it(`getDisplayPermissions should return "${expected}"`, () => {
      // Arrange
      const i18nMock = UsersPanelComponentMockFactory.createI18nMock();
      const component = UsersPanelComponentMockFactory.createComponent(i18nMock);

      // Action
      const result = component.getDisplayPermissions(user);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { currentUserId: null, userId: 'user-1', expected: false },
    { currentUserId: 'user-2', userId: 'user-1', expected: false },
    { currentUserId: 'user-1', userId: 'user-1', expected: true }
  ].forEach(({ currentUserId, userId, expected }) => {
    it(`isCurrentUser should return ${expected} for currentUserId=${String(currentUserId)} and userId=${userId}`, () => {
      // Arrange
      const i18nMock = UsersPanelComponentMockFactory.createI18nMock();
      const component = UsersPanelComponentMockFactory.createComponent(i18nMock);
      component.currentUserId = currentUserId;
      const user = UsersPanelComponentMockFactory.createUser({ id: userId });

      // Action
      const result = component.isCurrentUser(user);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
