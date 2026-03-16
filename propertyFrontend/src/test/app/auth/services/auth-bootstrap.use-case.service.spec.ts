import { DestroyRef, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthBootstrapUseCaseService } from 'src/app/auth/services/auth-bootstrap.use-case.service';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/core/api/services/api-session-events.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

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

  static createListingQueryOrchestratorMock() {
    return {
      resetGuestListingState: jasmine.createSpy('resetGuestListingState'),
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo(undefined)
    };
  }

  static createAppShellStateMock() {
    return {
      selectedLanguage: signal<'en' | 'sp'>('en'),
      backendBaseUrl: signal(''),
      staticMediaBaseUrl: signal(''),
      googleMapsApiKey: signal<string | null>(null),
      googleMapsMapId: signal<string | null>(null),
      googleLoginEnabled: signal(false),
      authenticatedUser: signal<any>(null),
      users: signal<any[]>([]),
      activeTab: signal<'DASHBOARD' | 'MAP_TAB' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB'>('DASHBOARD')
    };
  }
}

describe('AuthBootstrapUseCaseService', () => {
  it('whenInitializing_initialize_shouldConfigureRuntimeAndLoadSession', async () => {
    // Arrange
    const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
    const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
    const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
    const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
    const listingQueryOrchestrator = AuthBootstrapUseCaseServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AuthBootstrapUseCaseServiceMockFactory.createAppShellStateMock();
    const service = new AuthBootstrapUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      runtimeConfig as unknown as ApiRuntimeConfigService,
      authFacade as unknown as AuthFacadeService,
      sessionCoordinator as unknown as SessionCoordinatorService,
      sessionEvents.sessionEvents as unknown as ApiSessionEventsService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const http = {} as any;
    const destroyRef = new FakeDestroyRef() as unknown as DestroyRef;

    // Action
    await service.initialize(http, destroyRef, 'localhost', 'selected-language');

    // Assert
    expect(listingStateFacade.loadSelectedLanguageFromSession).toHaveBeenCalledOnceWith('selected-language');
    expect(appShellState.selectedLanguage()).toBe('sp');
    expect(listingStateFacade.loadBackendConfiguration).toHaveBeenCalledOnceWith(http);
    expect(runtimeConfig.setConfiguration).toHaveBeenCalledTimes(1);
    expect(appShellState.backendBaseUrl()).toBe('http://api.local:8081');
    expect(appShellState.staticMediaBaseUrl()).toBe('http://static.local/');
    expect(appShellState.googleMapsApiKey()).toBe('maps-key');
    expect(appShellState.googleMapsMapId()).toBe('maps-id');
    expect(authFacade.warnIfAuthHostMismatch).toHaveBeenCalledOnceWith('localhost');
    expect(authFacade.loadGoogleLoginAvailability).toHaveBeenCalledOnceWith(http);
    expect(appShellState.googleLoginEnabled()).toBeTrue();
    expect(sessionCoordinator.loadCurrentUserAndApplyState).toHaveBeenCalledOnceWith(http);
  });

  it('whenUnauthorizedArrivesAndUserIsUnauthenticated_initialize_shouldIgnoreEvent', async () => {
    // Arrange
    const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
    const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
    const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
    const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
    const listingQueryOrchestrator = AuthBootstrapUseCaseServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AuthBootstrapUseCaseServiceMockFactory.createAppShellStateMock();
    const service = new AuthBootstrapUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      runtimeConfig as unknown as ApiRuntimeConfigService,
      authFacade as unknown as AuthFacadeService,
      sessionCoordinator as unknown as SessionCoordinatorService,
      sessionEvents.sessionEvents as unknown as ApiSessionEventsService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );

    // Action
    await service.initialize({} as any, new FakeDestroyRef() as unknown as DestroyRef, 'localhost', 'selected-language');
    sessionEvents.unauthorizedSubject.next();

    // Assert
    expect(listingQueryOrchestrator.resetGuestListingState).not.toHaveBeenCalled();
    expect(listingQueryOrchestrator.refreshListingData).not.toHaveBeenCalled();
  });

  [
    { tab: 'USERS_TAB', shouldSetDashboard: true },
    { tab: 'DATABASE_MAINTENANCE_TAB', shouldSetDashboard: true },
    { tab: 'DASHBOARD', shouldSetDashboard: false },
    { tab: 'MAP_TAB', shouldSetDashboard: false }
  ].forEach(({ tab, shouldSetDashboard }) => {
    it(`whenUnauthorizedArrivesOn${tab}_initialize_shouldResetSessionState`, async () => {
      // Arrange
      const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
      const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
      const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
      const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
      const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
      const listingQueryOrchestrator = AuthBootstrapUseCaseServiceMockFactory.createListingQueryOrchestratorMock();
      const appShellState = AuthBootstrapUseCaseServiceMockFactory.createAppShellStateMock();
      appShellState.activeTab.set(tab as any);
      appShellState.authenticatedUser.set({ id: 'user-1' });
      appShellState.users.set([{ id: 'managed-user-1' }]);
      const service = new AuthBootstrapUseCaseService(
        listingStateFacade as unknown as ListingStateFacadeService,
        runtimeConfig as unknown as ApiRuntimeConfigService,
        authFacade as unknown as AuthFacadeService,
        sessionCoordinator as unknown as SessionCoordinatorService,
        sessionEvents.sessionEvents as unknown as ApiSessionEventsService,
        listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
        appShellState as unknown as AppShellStateService
      );
      const http = {} as any;

      // Action
      await service.initialize(http, new FakeDestroyRef() as unknown as DestroyRef, 'localhost', 'selected-language');
      sessionEvents.unauthorizedSubject.next();

      // Assert
      expect(appShellState.authenticatedUser()).toBeNull();
      expect(appShellState.users()).toEqual([]);
      expect(listingQueryOrchestrator.resetGuestListingState).toHaveBeenCalledTimes(1);
      if (shouldSetDashboard) {
        expect(appShellState.activeTab()).toBe('DASHBOARD');
      } else {
        expect(appShellState.activeTab()).toBe(tab as any);
      }
      expect(listingQueryOrchestrator.refreshListingData).toHaveBeenCalledOnceWith(http);
    });
  });

  it('whenDestroyRefIsDestroyed_initialize_shouldUnsubscribeUnauthorizedListener', async () => {
    // Arrange
    const listingStateFacade = AuthBootstrapUseCaseServiceMockFactory.createListingStateFacadeMock();
    const runtimeConfig = AuthBootstrapUseCaseServiceMockFactory.createRuntimeConfigMock();
    const authFacade = AuthBootstrapUseCaseServiceMockFactory.createAuthFacadeMock();
    const sessionCoordinator = AuthBootstrapUseCaseServiceMockFactory.createSessionCoordinatorMock();
    const sessionEvents = AuthBootstrapUseCaseServiceMockFactory.createSessionEventsMock();
    const listingQueryOrchestrator = AuthBootstrapUseCaseServiceMockFactory.createListingQueryOrchestratorMock();
    const appShellState = AuthBootstrapUseCaseServiceMockFactory.createAppShellStateMock();
    appShellState.authenticatedUser.set({ id: 'user-1' });
    const service = new AuthBootstrapUseCaseService(
      listingStateFacade as unknown as ListingStateFacadeService,
      runtimeConfig as unknown as ApiRuntimeConfigService,
      authFacade as unknown as AuthFacadeService,
      sessionCoordinator as unknown as SessionCoordinatorService,
      sessionEvents.sessionEvents as unknown as ApiSessionEventsService,
      listingQueryOrchestrator as unknown as ListingQueryOrchestratorService,
      appShellState as unknown as AppShellStateService
    );
    const destroyRef = new FakeDestroyRef();

    // Action
    await service.initialize({} as any, destroyRef as unknown as DestroyRef, 'localhost', 'selected-language');
    destroyRef.destroy();
    sessionEvents.unauthorizedSubject.next();

    // Assert
    expect(listingQueryOrchestrator.resetGuestListingState).not.toHaveBeenCalled();
    expect(listingQueryOrchestrator.refreshListingData).not.toHaveBeenCalled();
  });
});
