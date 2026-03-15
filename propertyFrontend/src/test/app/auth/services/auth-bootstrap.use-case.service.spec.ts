import { DestroyRef } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthBootstrapUseCaseService } from 'src/app/auth/services/auth-bootstrap.use-case.service';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/core/api/services/api-session-events.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';

class FakeDestroyRef implements DestroyRef {
  private callbacks: Array<() => void> = [];
  private isDestroyed = false;

  get destroyed(): boolean {
    return this.isDestroyed;
  }

  onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((item) => item !== callback);
    };
  }

  destroy(): void {
    this.isDestroyed = true;
    this.callbacks.forEach((callback) => callback());
  }
}

class AuthBootstrapUseCaseServiceMockFactory {
  static createListingStateFacadeMock() {
    return {
      loadSelectedLanguageFromSession: jasmine.createSpy('loadSelectedLanguageFromSession').and.returnValue('sp'),
      loadBackendConfiguration: jasmine.createSpy('loadBackendConfiguration').and.resolveTo({
        backendBaseUrl: 'http://backend-from-config:8081',
        staticMediaBaseUrl: 'http://media-from-config/',
        googleMapsApiKey: 'maps-key',
        googleMapsMapId: 'maps-id'
      })
    };
  }

  static createRuntimeConfigMock() {
    return {
      setConfiguration: jasmine.createSpy('setConfiguration'),
      getBackendBaseUrl: jasmine.createSpy('getBackendBaseUrl').and.returnValue('http://api.local:8081'),
      getStaticMediaBaseUrl: jasmine.createSpy('getStaticMediaBaseUrl').and.returnValue('http://static.local/')
    };
  }

  static createAuthFacadeMock() {
    return {
      warnIfAuthHostMismatch: jasmine.createSpy('warnIfAuthHostMismatch'),
      loadGoogleLoginAvailability: jasmine.createSpy('loadGoogleLoginAvailability').and.resolveTo(true)
    };
  }

  static createSessionCoordinatorMock() {
    return {
      loadCurrentUserAndApplyState: jasmine.createSpy('loadCurrentUserAndApplyState').and.resolveTo(undefined)
    };
  }

  static createSessionEventsMock() {
    const unauthorizedSubject = new Subject<void>();
    return {
      unauthorizedSubject,
      sessionEvents: {
        unauthorized$: unauthorizedSubject.asObservable()
      }
    };
  }

  static createHttpClientMock() {
    return {} as any;
  }

  static createParams(overrides: Partial<any> = {}) {
    return {
      http: AuthBootstrapUseCaseServiceMockFactory.createHttpClientMock(),
      destroyRef: new FakeDestroyRef() as unknown as DestroyRef,
      frontendHost: 'localhost',
      selectedLanguageKey: 'selected-language',
      setSelectedLanguage: jasmine.createSpy('setSelectedLanguage'),
      setBackendBaseUrl: jasmine.createSpy('setBackendBaseUrl'),
      setStaticMediaBaseUrl: jasmine.createSpy('setStaticMediaBaseUrl'),
      setGoogleMapsApiKey: jasmine.createSpy('setGoogleMapsApiKey'),
      setGoogleMapsMapId: jasmine.createSpy('setGoogleMapsMapId'),
      setGoogleLoginEnabled: jasmine.createSpy('setGoogleLoginEnabled'),
      activeTab: 'USERS_TAB',
      canMaintainDatabase: () => true,
      canEditUsers: () => true,
      setAuthenticatedUser: jasmine.createSpy('setAuthenticatedUser'),
      setActiveTab: jasmine.createSpy('setActiveTab'),
      onLoadUserPreferences: jasmine.createSpy('onLoadUserPreferences').and.resolveTo(undefined),
      onLoadUsers: jasmine.createSpy('onLoadUsers').and.resolveTo(undefined),
      onResetGuestState: jasmine.createSpy('onResetGuestState'),
      isAuthenticated: () => false,
      getActiveTab: () => 'DASHBOARD',
      onRefreshListingData: jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined),
      ...overrides
    };
  }
}

describe('AuthBootstrapUseCaseService', () => {
  it('initialize should configure runtime, auth options and session loading', async () => {
    // Arrange
    const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
    const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
    const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
    const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
    const service = new AuthBootstrapUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      runtimeConfig as unknown as ApiRuntimeConfigService,
      authFacade as unknown as AuthFacadeService,
      sessionCoordinator as unknown as SessionCoordinatorService,
      sessionEvents.sessionEvents as unknown as ApiSessionEventsService
    );
    const params = AuthBootstrapUseCaseServiceMockFactory.createParams({
      activeTab: 'DATABASE_MAINTENANCE_TAB'
    });

    // Action
    await service.initialize(params as any);

    // Assert
    expect(listingStateFacade.loadSelectedLanguageFromSession).toHaveBeenCalledOnceWith('selected-language');
    expect(params.setSelectedLanguage).toHaveBeenCalledOnceWith('sp');
    expect(listingStateFacade.loadBackendConfiguration).toHaveBeenCalledOnceWith(params.http);
    expect(runtimeConfig.setConfiguration).toHaveBeenCalledTimes(1);
    expect(params.setBackendBaseUrl).toHaveBeenCalledOnceWith('http://api.local:8081');
    expect(params.setStaticMediaBaseUrl).toHaveBeenCalledOnceWith('http://static.local/');
    expect(params.setGoogleMapsApiKey).toHaveBeenCalledOnceWith('maps-key');
    expect(params.setGoogleMapsMapId).toHaveBeenCalledOnceWith('maps-id');
    expect(authFacade.warnIfAuthHostMismatch).toHaveBeenCalledOnceWith('localhost');
    expect(authFacade.loadGoogleLoginAvailability).toHaveBeenCalledOnceWith(params.http);
    expect(params.setGoogleLoginEnabled).toHaveBeenCalledOnceWith(true);
    expect(sessionCoordinator.loadCurrentUserAndApplyState).toHaveBeenCalledOnceWith({
      http: params.http,
      activeTab: 'DATABASE_MAINTENANCE_TAB',
      canMaintainDatabase: params.canMaintainDatabase,
      canEditUsers: params.canEditUsers,
      setAuthenticatedUser: params.setAuthenticatedUser,
      setActiveTab: params.setActiveTab,
      onLoadUserPreferences: params.onLoadUserPreferences,
      onLoadUsers: params.onLoadUsers,
      onResetGuestState: params.onResetGuestState
    });
  });

  it('initialize should ignore unauthorized events while user is already unauthenticated', async () => {
    // Arrange
    const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
    const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
    const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
    const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
    const service = new AuthBootstrapUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      runtimeConfig as unknown as ApiRuntimeConfigService,
      authFacade as unknown as AuthFacadeService,
      sessionCoordinator as unknown as SessionCoordinatorService,
      sessionEvents.sessionEvents as unknown as ApiSessionEventsService
    );
    const params = AuthBootstrapUseCaseServiceMockFactory.createParams({
      isAuthenticated: () => false
    });

    // Action
    await service.initialize(params as any);
    sessionEvents.unauthorizedSubject.next();

    // Assert
    expect(params.setAuthenticatedUser).not.toHaveBeenCalled();
    expect(params.onResetGuestState).not.toHaveBeenCalled();
    expect(params.setActiveTab).not.toHaveBeenCalled();
    expect(params.onRefreshListingData).not.toHaveBeenCalled();
  });

  [
    { tab: 'USERS_TAB', shouldSetDashboard: true },
    { tab: 'DATABASE_MAINTENANCE_TAB', shouldSetDashboard: true },
    { tab: 'DASHBOARD', shouldSetDashboard: false },
    { tab: 'MAP_TAB', shouldSetDashboard: false }
  ].forEach(({ tab, shouldSetDashboard }) => {
    it(`initialize should reset session on unauthorized for active tab ${tab}`, async () => {
      // Arrange
      const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
      const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
      const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
      const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
      const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
      const service = new AuthBootstrapUseCaseService(
        listingStateFacade as unknown as ListingStateFacadeService,
        runtimeConfig as unknown as ApiRuntimeConfigService,
        authFacade as unknown as AuthFacadeService,
        sessionCoordinator as unknown as SessionCoordinatorService,
        sessionEvents.sessionEvents as unknown as ApiSessionEventsService
      );
      const params = AuthBootstrapUseCaseServiceMockFactory.createParams({
        isAuthenticated: () => true,
        getActiveTab: () => tab as any
      });

      // Action
      await service.initialize(params as any);
      sessionEvents.unauthorizedSubject.next();

      // Assert
      expect(params.setAuthenticatedUser).toHaveBeenCalledOnceWith(null);
      expect(params.onResetGuestState).toHaveBeenCalledTimes(1);
      if (shouldSetDashboard) {
        expect(params.setActiveTab).toHaveBeenCalledOnceWith('DASHBOARD');
      } else {
        expect(params.setActiveTab).not.toHaveBeenCalled();
      }
      expect(params.onRefreshListingData).toHaveBeenCalledTimes(1);
    });
  });

  it('initialize should unsubscribe unauthorized listener when destroyRef is destroyed', async () => {
    // Arrange
    const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
    const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
    const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
    const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
    const service = new AuthBootstrapUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      runtimeConfig as unknown as ApiRuntimeConfigService,
      authFacade as unknown as AuthFacadeService,
      sessionCoordinator as unknown as SessionCoordinatorService,
      sessionEvents.sessionEvents as unknown as ApiSessionEventsService
    );
    const destroyRef = new FakeDestroyRef();
    const params = AuthBootstrapUseCaseServiceMockFactory.createParams({
      destroyRef: destroyRef as unknown as DestroyRef,
      isAuthenticated: () => true
    });

    // Action
    await service.initialize(params as any);
    destroyRef.destroy();
    sessionEvents.unauthorizedSubject.next();

    // Assert
    expect(params.setAuthenticatedUser).not.toHaveBeenCalled();
    expect(params.onResetGuestState).not.toHaveBeenCalled();
    expect(params.setActiveTab).not.toHaveBeenCalled();
    expect(params.onRefreshListingData).not.toHaveBeenCalled();
  });
});
