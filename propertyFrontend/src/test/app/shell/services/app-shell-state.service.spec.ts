import { signal } from '@angular/core';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';
import { ListingPropertyRow } from 'src/app/listing/model/listing.types';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';

class AppShellStateServiceMockFactory {
  static createProperty(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'p-1',
      publicationDate: '2026-03-12T10:00:00.000Z',
      publicationDateShort: '2026-03-12',
      title: 'Title',
      url: 'https://example.com/p-1',
      price: '1400',
      location: 'Madrid',
      advertiserComment: 'comment',
      localImageUrls: [],
      unavailable: false,
      geoLocationHint: null,
      ...overrides
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

  static createPropertySelectionServiceMock() {
    return {
      selectedProperty: signal<ListingPropertyRow | null>(null),
      lockedSelectedPropertyKey: signal<string | null>(null)
    };
  }

  static createWorkspaceInteractionCoordinatorServiceMock() {
    return {
      leftPanelHidden: signal<boolean>(false),
      rightPanelHidden: signal<boolean>(false)
    };
  }
}

describe('AppShellStateService', () => {
  it('should initialize default shell state and preserve injected signals', () => {
    // Arrange
    const propertySelectionMock =
      AppShellStateServiceMockFactory.createPropertySelectionServiceMock();
    const workspaceMock =
      AppShellStateServiceMockFactory.createWorkspaceInteractionCoordinatorServiceMock();

    // Action
    const service = new AppShellStateService(
      propertySelectionMock as unknown as PropertySelectionService,
      workspaceMock as unknown as WorkspaceInteractionCoordinatorService
    );

    // Assert
    expect(service.backendBaseUrl()).toBe(ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL);
    expect(service.staticMediaBaseUrl()).toBe(
      ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL
    );
    expect(service.googleMapsApiKey()).toBeNull();
    expect(service.googleMapsMapId()).toBeNull();
    expect(service.loading()).toBeTrue();
    expect(service.count()).toBe(0);
    expect(service.selectedLanguage()).toBe('en');
    expect(service.activeTab()).toBe('DASHBOARD');
    expect(service.googleLoginEnabled()).toBeTrue();
    expect(service.authenticatedUser()).toBeNull();
    expect(service.users()).toEqual([]);
    expect(service.usersLoading()).toBeFalse();
    expect(service.propertyLabels()).toEqual([]);
    expect(service.maintenanceRunning()).toBeFalse();
    expect(service.maintenanceResultText()).toBe('');
    expect(service.sortCriteria()).toEqual([]);
    expect(service.selectedProperty).toBe(propertySelectionMock.selectedProperty);
    expect(service.lockedSelectedPropertyKey).toBe(propertySelectionMock.lockedSelectedPropertyKey);
    expect(service.leftPanelHidden).toBe(workspaceMock.leftPanelHidden);
    expect(service.rightPanelHidden).toBe(workspaceMock.rightPanelHidden);
    expect(service.maintenanceOperations.length).toBe(1);
    expect(service.maintenanceOperations[0] instanceof RemoveDanglingImagesOperation).toBeTrue();
  });

  it('computed getters should react to state updates', () => {
    // Arrange
    const propertySelectionMock =
      AppShellStateServiceMockFactory.createPropertySelectionServiceMock();
    const workspaceMock =
      AppShellStateServiceMockFactory.createWorkspaceInteractionCoordinatorServiceMock();
    const service = new AppShellStateService(
      propertySelectionMock as unknown as PropertySelectionService,
      workspaceMock as unknown as WorkspaceInteractionCoordinatorService
    );
    const row = AppShellStateServiceMockFactory.createProperty();

    // Action
    service.allProperties.set([row]);
    service.filteredTotalElements.set(25);
    service.backendBaseUrl.set('http://localhost:8081');
    service.authenticatedUser.set(
      AppShellStateServiceMockFactory.createUser({
        permissions: ['canEditUsers', 'canMaintainDatabase']
      })
    );
    const computedProperties = service.properties();
    const computedVisibleCount = service.visibleCount();
    const canEditUsers = service.canEditUsers();
    const canMaintainDatabase = service.canMaintainDatabase();
    const avatarUrl = service.authenticatedUserAvatarUrl();
    service.authenticatedUser.set(AppShellStateServiceMockFactory.createUser({ permissions: [] }));
    const canEditUsersAfterReset = service.canEditUsers();
    const canMaintainDatabaseAfterReset = service.canMaintainDatabase();
    service.authenticatedUser.set(null);
    const avatarUrlWithoutUser = service.authenticatedUserAvatarUrl();

    // Assert
    expect(computedProperties).toEqual([row]);
    expect(computedVisibleCount).toBe(25);
    expect(canEditUsers).toBeTrue();
    expect(canMaintainDatabase).toBeTrue();
    expect(avatarUrl).toBe('http://localhost:8081/auth/google/avatar');
    expect(canEditUsersAfterReset).toBeFalse();
    expect(canMaintainDatabaseAfterReset).toBeFalse();
    expect(avatarUrlWithoutUser).toBeNull();
  });
});
