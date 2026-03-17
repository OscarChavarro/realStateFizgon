import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { ListingTopBarComponent } from 'src/app/listing/components/listing-top-bar/listing-top-bar.component';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import { ListingTab } from 'src/app/listing/model/listing.types';

class ListingTopBarMockFactory {
  static createFilters(overrides: Partial<ListingFiltersState> = {}): ListingFiltersState {
    return {
      ...createDefaultListingFilters(),
      ...overrides
    };
  }

  static createAuthenticatedUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
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

describe('ListingTopBarComponent', () => {
  let fixture: ComponentFixture<ListingTopBarComponent>;
  let component: ListingTopBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingTopBarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ListingTopBarComponent);
    component = fixture.componentInstance;
  });

  it('should expose expected default input values', () => {
    // Arrange

    // Action
    const defaults = {
      activeTab: component.activeTab,
      visibleCount: component.visibleCount,
      totalCount: component.totalCount,
      loading: component.loading,
      selectedLanguage: component.selectedLanguage,
      layoutCycleIcon: component.layoutCycleIcon,
      googleLoginEnabled: component.googleLoginEnabled,
      authenticatedUser: component.authenticatedUser,
      authenticatedUserAvatarUrl: component.authenticatedUserAvatarUrl,
      canEditUsers: component.canEditUsers,
      canMaintainDatabase: component.canMaintainDatabase
    };

    // Assert
    expect(defaults).toEqual({
      activeTab: 'DASHBOARD',
      visibleCount: 0,
      totalCount: 0,
      loading: false,
      selectedLanguage: 'en',
      layoutCycleIcon: 'vertical_split',
      googleLoginEnabled: true,
      authenticatedUser: null,
      authenticatedUserAvatarUrl: null,
      canEditUsers: false,
      canMaintainDatabase: false
    });
    expect(component.filters).toEqual(createDefaultListingFilters());
  });

  const tabCases: readonly ListingTab[] = [
    'DASHBOARD',
    'MAP_TAB',
    'DATABASE_MAINTENANCE_TAB',
    'USERS_TAB'
  ];

  tabCases.forEach((tab) => {
    it(`selectTab should emit ${tab}`, () => {
      // Arrange
      const emitSpy = spyOn(component.tabChange, 'emit');

      // Action
      component.selectTab(tab as ListingTab);

      // Assert
      expect(emitSpy).toHaveBeenCalledOnceWith(tab);
    });
  });

  const languageCases: ReadonlyArray<{ value: string; expected: 'en' | 'sp' }> = [
    { value: 'sp', expected: 'sp' },
    { value: 'en', expected: 'en' },
    { value: 'de', expected: 'en' },
    { value: '', expected: 'en' }
  ];

  languageCases.forEach(({ value, expected }) => {
    it(`onLanguageSelect should emit ${expected} for "${value}"`, () => {
      // Arrange
      const emitSpy = spyOn(component.languageChange, 'emit');

      // Action
      component.onLanguageSelect(value);

      // Assert
      expect(emitSpy).toHaveBeenCalledOnceWith(expected);
    });
  });

  it('onFullscreenButtonClick should emit fullscreen request', () => {
    // Arrange
    const emitSpy = spyOn(component.fullscreenRequest, 'emit');

    // Action
    component.onFullscreenButtonClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith();
  });

  it('onLayoutCycleButtonClick should emit layout cycle request', () => {
    // Arrange
    const emitSpy = spyOn(component.layoutCycleRequest, 'emit');

    // Action
    component.onLayoutCycleButtonClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith();
  });

  it('onFiltersUpdate should emit provided filters object', () => {
    // Arrange
    const filters = ListingTopBarMockFactory.createFilters({
      showClosed: false,
      minPrice: '1000',
      maxPrice: '2000'
    });
    const emitSpy = spyOn(component.filtersChange, 'emit');

    // Action
    component.onFiltersUpdate(filters);

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(filters);
  });

  it('onGoogleLoginClicked should emit login request', () => {
    // Arrange
    const emitSpy = spyOn(component.googleLoginRequest, 'emit');

    // Action
    component.onGoogleLoginClicked();

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith();
  });

  it('onLogoutClicked should emit logout request', () => {
    // Arrange
    const emitSpy = spyOn(component.logoutRequest, 'emit');

    // Action
    component.onLogoutClicked();

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith();
  });

  [
    { language: 'en' as const, key: 'SHOWING_PROPERTIES' as const, expected: 'Showing' },
    { language: 'sp' as const, key: 'SHOWING_PROPERTIES' as const, expected: 'Mostrando' }
  ].forEach(({ language, key, expected }) => {
    it(`t should return translated value "${expected}" for ${language}`, () => {
      // Arrange
      component.selectedLanguage = language;

      // Action
      const translated = component.t(key);

      // Assert
      expect(translated).toBe(expected);
    });
  });

  it('should allow assigning authenticated user related inputs', () => {
    // Arrange
    const user = ListingTopBarMockFactory.createAuthenticatedUser({
      roles: ['ADMIN'],
      permissions: ['canEditUsers', 'canMaintainDatabase']
    });

    // Action
    component.authenticatedUser = user;
    component.authenticatedUserAvatarUrl = 'https://example.com/avatar.png';
    component.canEditUsers = true;
    component.canMaintainDatabase = true;

    // Assert
    expect(component.authenticatedUser).toEqual(user);
    expect(component.authenticatedUserAvatarUrl).toBe('https://example.com/avatar.png');
    expect(component.canEditUsers).toBeTrue();
    expect(component.canMaintainDatabase).toBeTrue();
  });
});
