import { ElementRef, SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserMenuComponent } from 'src/app/auth/components/user-menu/user-menu.component';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';

class UserMenuComponentMockFactory {
  static createI18nMock() {
    return {
      get: jasmine
        .createSpy('get')
        .and.callFake((id: string, language: string) => `${id}:${language}`)
    };
  }

  static createHostElementMock() {
    return {
      nativeElement: {
        contains: jasmine.createSpy('contains').and.returnValue(false)
      }
    };
  }

  static createComponent(
    i18nMock: { get: jasmine.Spy },
    hostElementMock: { nativeElement: { contains: jasmine.Spy } }
  ): UserMenuComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18nMock },
        { provide: ElementRef, useValue: hostElementMock as unknown as ElementRef<HTMLElement> }
      ]
    });
    return TestBed.runInInjectionContext(() => new UserMenuComponent());
  }

  static createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
    return {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User Name',
      picture: null,
      roles: ['STANDARD_USER'],
      permissions: [],
      ...overrides
    };
  }
}

describe('UserMenuComponent', () => {
  it('ngOnChanges should reset avatarLoadFailed when avatarUrl changes', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    component.avatarLoadFailed.set(true);

    // Action
    component.ngOnChanges({
      avatarUrl: new SimpleChange('old', 'new', false)
    });

    // Assert
    expect(component.avatarLoadFailed()).toBeFalse();
  });

  it('onToggleMenu should toggle menu state', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);

    // Action
    component.onToggleMenu();
    const afterFirstToggle = component.menuOpen();
    component.onToggleMenu();
    const afterSecondToggle = component.menuOpen();

    // Assert
    expect(afterFirstToggle).toBeTrue();
    expect(afterSecondToggle).toBeFalse();
  });

  it('onGoogleLoginClick should do nothing when google login is disabled', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    const emitSpy = spyOn(component.googleLoginRequest, 'emit');
    component.googleLoginEnabled = false;
    component.menuOpen.set(true);

    // Action
    component.onGoogleLoginClick();

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
    expect(component.menuOpen()).toBeTrue();
  });

  it('onGoogleLoginClick should close menu and emit when enabled', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    const emitSpy = spyOn(component.googleLoginRequest, 'emit');
    component.googleLoginEnabled = true;
    component.menuOpen.set(true);

    // Action
    component.onGoogleLoginClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(component.menuOpen()).toBeFalse();
  });

  it('onLogoutClick should close menu and emit logout', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    const emitSpy = spyOn(component.logoutRequest, 'emit');
    component.menuOpen.set(true);

    // Action
    component.onLogoutClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(component.menuOpen()).toBeFalse();
  });

  it('onAvatarError should set avatarLoadFailed to true', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);

    // Action
    component.onAvatarError();

    // Assert
    expect(component.avatarLoadFailed()).toBeTrue();
  });

  it('onDocumentClick should ignore clicks when menu is closed', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    component.menuOpen.set(false);

    // Action
    component.onDocumentClick({ target: document.createElement('div') } as unknown as MouseEvent);

    // Assert
    expect(component.menuOpen()).toBeFalse();
    expect(hostElementMock.nativeElement.contains).not.toHaveBeenCalled();
  });

  it('onDocumentClick should keep menu open for inside clicks', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    hostElementMock.nativeElement.contains.and.returnValue(true);
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    component.menuOpen.set(true);
    const target = document.createElement('div');

    // Action
    component.onDocumentClick({ target } as unknown as MouseEvent);

    // Assert
    expect(hostElementMock.nativeElement.contains).toHaveBeenCalledOnceWith(target);
    expect(component.menuOpen()).toBeTrue();
  });

  it('onDocumentClick should close menu for outside clicks and null target', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    hostElementMock.nativeElement.contains.and.returnValue(false);
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    component.menuOpen.set(true);

    // Action
    component.onDocumentClick({ target: document.createElement('div') } as unknown as MouseEvent);
    component.menuOpen.set(true);
    component.onDocumentClick({ target: null } as MouseEvent);

    // Assert
    expect(component.menuOpen()).toBeFalse();
  });

  it('onEscape should always close menu', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    component.menuOpen.set(true);

    // Action
    component.onEscape();

    // Assert
    expect(component.menuOpen()).toBeFalse();
  });

  it('t should delegate translation lookup', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.t('USER_MENU');

    // Assert
    expect(i18nMock.get).toHaveBeenCalledOnceWith('USER_MENU', 'sp');
    expect(result).toBe('USER_MENU:sp');
  });

  [
    {
      user: UserMenuComponentMockFactory.createUser({
        name: '   Name   ',
        email: 'mail@example.com'
      }),
      expected: 'Name'
    },
    {
      user: UserMenuComponentMockFactory.createUser({ name: '   ', email: '  mail@example.com  ' }),
      expected: 'mail@example.com'
    },
    {
      user: UserMenuComponentMockFactory.createUser({ name: '   ', email: '   ' }),
      expected: 'SIGNED_IN_USER:en'
    },
    { user: null, expected: 'SIGNED_IN_USER:en' }
  ].forEach(({ user, expected }) => {
    it(`displayName should resolve to "${expected}"`, () => {
      // Arrange
      const i18nMock = UserMenuComponentMockFactory.createI18nMock();
      const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
      const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
      component.authenticatedUser = user;

      // Action
      const result = component.displayName;

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { user: null, displayRole: 'STANDARD_USER', shouldShowRole: false },
    {
      user: UserMenuComponentMockFactory.createUser({ roles: [] }),
      displayRole: 'STANDARD_USER',
      shouldShowRole: false
    },
    {
      user: UserMenuComponentMockFactory.createUser({ roles: ['STANDARD_USER'] }),
      displayRole: 'STANDARD_USER',
      shouldShowRole: false
    },
    {
      user: UserMenuComponentMockFactory.createUser({ roles: ['ADMIN'] }),
      displayRole: 'ADMIN',
      shouldShowRole: true
    },
    {
      user: UserMenuComponentMockFactory.createUser({ roles: ['STANDARD_USER', 'ADMIN'] }),
      displayRole: 'STANDARD_USER, ADMIN',
      shouldShowRole: true
    }
  ].forEach(({ user, displayRole, shouldShowRole }) => {
    it(`role getters should resolve displayRole="${displayRole}" and shouldShowRole=${shouldShowRole}`, () => {
      // Arrange
      const i18nMock = UserMenuComponentMockFactory.createI18nMock();
      const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
      const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);
      component.authenticatedUser = user as AuthenticatedUser | null;

      // Action
      const resolvedRole = component.displayRole;
      const resolvedShouldShowRole = component.shouldShowRole;

      // Assert
      expect(resolvedRole).toBe(displayRole);
      expect(resolvedShouldShowRole).toBe(shouldShowRole);
    });
  });

  it('showAvatarImage should require avatar url and no load failure', () => {
    // Arrange
    const i18nMock = UserMenuComponentMockFactory.createI18nMock();
    const hostElementMock = UserMenuComponentMockFactory.createHostElementMock();
    const component = UserMenuComponentMockFactory.createComponent(i18nMock, hostElementMock);

    // Action
    component.avatarUrl = null;
    const noUrl = component.showAvatarImage;
    component.avatarUrl = 'http://avatar';
    component.avatarLoadFailed.set(true);
    const failed = component.showAvatarImage;
    component.avatarLoadFailed.set(false);
    const visible = component.showAvatarImage;

    // Assert
    expect(noUrl).toBeFalse();
    expect(failed).toBeFalse();
    expect(visible).toBeTrue();
  });
});
