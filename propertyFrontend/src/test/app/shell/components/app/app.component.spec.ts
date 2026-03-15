import { HttpClient } from '@angular/common/http';
import { computed, ElementRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { AuthBootstrapUseCaseService } from 'src/app/auth/services/auth-bootstrap.use-case.service';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { ListingFiltersState, createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { createDefaultListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { ListingPropertyRow, PropertyLabelEntry, SortCriterion } from 'src/app/listing/model/listing.types';
import { ListingBootstrapUseCaseService } from 'src/app/listing/services/listing-bootstrap.use-case.service';
import { ListingInteractionUseCaseService } from 'src/app/listing/services/listing-interaction.use-case.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';
import { AppComponent } from 'src/app/shell/components/app/app.component';
import { AppShellCommandsUseCaseService } from 'src/app/shell/services/app-shell-commands.use-case.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';
import { ShellInputInteractionUseCaseService } from 'src/app/shell/services/shell-input-interaction.use-case.service';

class AuthFacadeServiceMock {
  readonly buildGoogleLoginUrl = jasmine.createSpy('buildGoogleLoginUrl').and.returnValue('https://accounts.google.com/o/oauth2/v2/auth');
}

class ListingStateFacadeServiceMock {
  readonly persistSelectedLanguage = jasmine.createSpy('persistSelectedLanguage');
}

class WorkspaceInteractionCoordinatorServiceMock {
  readonly cycleLayout = jasmine.createSpy('cycleLayout');
  readonly getWorkspaceColumns = jasmine.createSpy('getWorkspaceColumns').and.returnValue('1fr 8px 1fr');
  readonly getCycleIcon = jasmine.createSpy('getCycleIcon').and.returnValue('view_sidebar');
  readonly toggleFullscreen = jasmine.createSpy('toggleFullscreen');
}

class AuthBootstrapUseCaseServiceMock {
  readonly initialize = jasmine.createSpy('initialize').and.resolveTo(undefined);
}

class ListingBootstrapUseCaseServiceMock {
  readonly initialize = jasmine.createSpy('initialize').and.resolveTo(undefined);
  readonly teardown = jasmine.createSpy('teardown');
}

class UserSessionManagementUseCaseServiceMock {
  readonly loadUsers = jasmine.createSpy('loadUsers').and.resolveTo(undefined);
}

class PropertySelectionServiceMock {
  readonly onRowHover = jasmine.createSpy('onRowHover');
  readonly onRowClick = jasmine.createSpy('onRowClick');
  readonly syncAfterRefresh = jasmine.createSpy('syncAfterRefresh');
}

class ListingQueryOrchestratorServiceMock {
  readonly readFilteredTotalElementsFromSession = jasmine.createSpy('readFilteredTotalElementsFromSession').and.returnValue(17);
  readonly refreshListingData = jasmine.createSpy('refreshListingData').and.resolveTo(undefined);
  readonly handleFiltersChange = jasmine.createSpy('handleFiltersChange').and.resolveTo(undefined);
  readonly loadUserPreferences = jasmine.createSpy('loadUserPreferences').and.resolveTo(undefined);
  readonly toggleSort = jasmine.createSpy('toggleSort').and.resolveTo(undefined);
  readonly changePage = jasmine.createSpy('changePage').and.resolveTo(undefined);
  readonly changePageSize = jasmine.createSpy('changePageSize').and.resolveTo(undefined);
  readonly persistFilteredTotalElementsInSession = jasmine.createSpy('persistFilteredTotalElementsInSession');
}

class ListingInteractionUseCaseServiceMock {
  readonly togglePropertyReview = jasmine.createSpy('togglePropertyReview').and.resolveTo(undefined);
  readonly savePropertyComment = jasmine.createSpy('savePropertyComment').and.resolveTo(undefined);
}

class ShellInputInteractionUseCaseServiceMock {
  readonly onSplitterMouseDown = jasmine.createSpy('onSplitterMouseDown');
  readonly onWindowMouseMove = jasmine.createSpy('onWindowMouseMove');
  readonly onWindowMouseUp = jasmine.createSpy('onWindowMouseUp');
  readonly onWindowKeyDown = jasmine.createSpy('onWindowKeyDown');
}

class AppShellCommandsUseCaseServiceMock {
  readonly onTabChange = jasmine.createSpy('onTabChange');
  readonly onLanguageChange = jasmine.createSpy('onLanguageChange');
  readonly onLogoutRequested = jasmine.createSpy('onLogoutRequested');
  readonly onDeleteUserRequested = jasmine.createSpy('onDeleteUserRequested');
  readonly onMaintenanceOperationRequested = jasmine.createSpy('onMaintenanceOperationRequested');
}

class AppShellStateServiceMock {
  readonly backendBaseUrl = signal('http://localhost:8081');
  readonly staticMediaBaseUrl = signal('http://localhost:8081/static/images');
  readonly googleMapsApiKey = signal<string | null>('map-key');
  readonly googleMapsMapId = signal<string | null>('map-id');

  readonly count = signal(0);
  readonly loading = signal(false);
  readonly allProperties = signal<ListingPropertyRow[]>([]);
  readonly filters = signal<ListingFiltersState>(createDefaultListingFilters());
  readonly pagination = signal(createDefaultListingPaginationState());
  readonly properties = computed(() => this.allProperties());
  readonly filteredTotalElements = signal(0);
  readonly visibleCount = computed(() => this.filteredTotalElements());
  readonly selectedLanguage = signal<'en' | 'sp'>('en');
  readonly activeTab = signal<'DASHBOARD' | 'MAP_TAB' | 'DATABASE_MAINTENANCE_TAB' | 'USERS_TAB'>('DASHBOARD');
  readonly googleLoginEnabled = signal(true);
  readonly authenticatedUser = signal<AuthenticatedUser | null>(null);
  readonly canEditUsers = computed(() => this.authenticatedUser()?.permissions.includes('canEditUsers') === true);
  readonly canMaintainDatabase = computed(() => this.authenticatedUser()?.permissions.includes('canMaintainDatabase') === true);
  readonly authenticatedUserAvatarUrl = computed(() => (
    this.authenticatedUser() ? `${this.backendBaseUrl()}/auth/google/avatar` : null
  ));
  readonly users = signal<AuthUserListItem[]>([]);
  readonly usersLoading = signal(false);
  readonly propertyLabels = signal<PropertyLabelEntry[]>([]);
  readonly maintenanceOperations = [new RemoveDanglingImagesOperation()];
  readonly maintenanceRunning = signal(false);
  readonly maintenanceResultText = signal('');
  readonly sortCriteria = signal<SortCriterion[]>([]);
  readonly selectedProperty = signal<ListingPropertyRow | null>(null);
  readonly lockedSelectedPropertyKey = signal<string | null>(null);
  readonly leftPanelHidden = signal(false);
  readonly rightPanelHidden = signal(false);
}

type AppComponentFixtureState = {
  fixture: ComponentFixture<AppComponent>;
  component: AppComponent;
  authFacade: AuthFacadeServiceMock;
  listingStateFacade: ListingStateFacadeServiceMock;
  workspaceInteraction: WorkspaceInteractionCoordinatorServiceMock;
  authBootstrap: AuthBootstrapUseCaseServiceMock;
  listingBootstrap: ListingBootstrapUseCaseServiceMock;
  userSessionManagement: UserSessionManagementUseCaseServiceMock;
  propertySelection: PropertySelectionServiceMock;
  listingQueryOrchestrator: ListingQueryOrchestratorServiceMock;
  listingInteractionUseCase: ListingInteractionUseCaseServiceMock;
  shellInputInteraction: ShellInputInteractionUseCaseServiceMock;
  appShellState: AppShellStateServiceMock;
  appShellCommands: AppShellCommandsUseCaseServiceMock;
};

class AppComponentMockFactory {
  static createProperty(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'property-1',
      publicationDate: '2026-03-15T12:00:00.000Z',
      publicationDateShort: '2026-03-15',
      title: 'Sample Property',
      url: 'https://example.com/property-1',
      price: '1400',
      location: 'Madrid',
      advertiserComment: 'Comment',
      localImageUrls: ['a.jpg'],
      unavailable: false,
      geoLocationHint: { lat: 40.4, lon: -3.7 },
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

  static createAuthUserListItem(overrides: Partial<AuthUserListItem> = {}): AuthUserListItem {
    return {
      id: 'managed-user-1',
      email: 'managed@example.com',
      name: 'Managed User',
      roles: ['STANDARD_USER'],
      permissions: [],
      createdAt: '2026-03-01T00:00:00.000Z',
      lastLoginAt: '2026-03-10T00:00:00.000Z',
      ...overrides
    };
  }

  static async createComponent(): Promise<AppComponentFixtureState> {
    const authFacade = new AuthFacadeServiceMock();
    const listingStateFacade = new ListingStateFacadeServiceMock();
    const workspaceInteraction = new WorkspaceInteractionCoordinatorServiceMock();
    const authBootstrap = new AuthBootstrapUseCaseServiceMock();
    const listingBootstrap = new ListingBootstrapUseCaseServiceMock();
    const userSessionManagement = new UserSessionManagementUseCaseServiceMock();
    const propertySelection = new PropertySelectionServiceMock();
    const listingQueryOrchestrator = new ListingQueryOrchestratorServiceMock();
    const listingInteractionUseCase = new ListingInteractionUseCaseServiceMock();
    const shellInputInteraction = new ShellInputInteractionUseCaseServiceMock();
    const appShellState = new AppShellStateServiceMock();
    const appShellCommands = new AppShellCommandsUseCaseServiceMock();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: HttpClient, useValue: {} },
        { provide: AuthFacadeService, useValue: authFacade },
        { provide: ListingStateFacadeService, useValue: listingStateFacade },
        { provide: WorkspaceInteractionCoordinatorService, useValue: workspaceInteraction },
        { provide: AuthBootstrapUseCaseService, useValue: authBootstrap },
        { provide: ListingBootstrapUseCaseService, useValue: listingBootstrap },
        { provide: UserSessionManagementUseCaseService, useValue: userSessionManagement },
        { provide: PropertySelectionService, useValue: propertySelection },
        { provide: ListingQueryOrchestratorService, useValue: listingQueryOrchestrator },
        { provide: ListingInteractionUseCaseService, useValue: listingInteractionUseCase },
        { provide: ShellInputInteractionUseCaseService, useValue: shellInputInteraction },
        { provide: AppShellStateService, useValue: appShellState },
        { provide: AppShellCommandsUseCaseService, useValue: appShellCommands }
      ]
    })
      .overrideComponent(AppComponent, {
        set: {
          template: ''
        }
      })
      .compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    return {
      fixture,
      component,
      authFacade,
      listingStateFacade,
      workspaceInteraction,
      authBootstrap,
      listingBootstrap,
      userSessionManagement,
      propertySelection,
      listingQueryOrchestrator,
      listingInteractionUseCase,
      shellInputInteraction,
      appShellState,
      appShellCommands
    };
  }
}

describe('AppComponent', () => {
  it('should expose shell state signals and simple getter methods', async () => {
    // Arrange
    const { component, appShellState } = await AppComponentMockFactory.createComponent();
    appShellState.staticMediaBaseUrl.set('http://cdn.example.com/images');
    appShellState.googleMapsApiKey.set('maps-key');
    appShellState.googleMapsMapId.set('maps-id');

    // Action
    const mediaBaseUrl = component.getStaticMediaBaseUrl();
    const mapsApiKey = component.getGoogleMapsApiKey();
    const mapsMapId = component.getGoogleMapsMapId();

    // Assert
    expect(mediaBaseUrl).toBe('http://cdn.example.com/images');
    expect(mapsApiKey).toBe('maps-key');
    expect(mapsMapId).toBe('maps-id');
    expect(component.count()).toBe(0);
    expect(component.visibleCount()).toBe(0);
    expect(component.activeTab()).toBe('DASHBOARD');
  });

  it('ngOnInit should call bootstrap services and expose callback contracts', async () => {
    // Arrange
    const {
      component,
      appShellState,
      authBootstrap,
      listingBootstrap,
      listingQueryOrchestrator
    } = await AppComponentMockFactory.createComponent();
    const user = AppComponentMockFactory.createAuthenticatedUser({
      roles: ['ADMIN'],
      permissions: ['canEditUsers', 'canMaintainDatabase']
    });
    const loadUserPreferencesSpy = spyOn<any>(component, 'loadUserPreferences').and.resolveTo(undefined);
    const loadUsersSpy = spyOn<any>(component, 'loadUsersForManagement').and.resolveTo(undefined);
    const resetGuestStateSpy = spyOn<any>(component, 'resetGuestState');
    const refreshListingDataSpy = spyOn<any>(component, 'refreshListingData').and.resolveTo(undefined);

    // Action
    await component.ngOnInit();
    const authParams = authBootstrap.initialize.calls.mostRecent().args[0];
    authParams.setSelectedLanguage('sp');
    authParams.setBackendBaseUrl('http://backend.internal');
    authParams.setStaticMediaBaseUrl('http://backend.internal/static/images');
    authParams.setGoogleMapsApiKey('maps-key-2');
    authParams.setGoogleMapsMapId('maps-id-2');
    authParams.setGoogleLoginEnabled(false);
    authParams.setAuthenticatedUser(user);
    authParams.setActiveTab('MAP_TAB');
    await authParams.onLoadUserPreferences();
    await authParams.onLoadUsers();
    authParams.onResetGuestState();
    await authParams.onRefreshListingData();
    const bootstrapParams = listingBootstrap.initialize.calls.mostRecent().args[0];
    await bootstrapParams.onRefreshListingData();

    // Assert
    expect(listingQueryOrchestrator.readFilteredTotalElementsFromSession).toHaveBeenCalled();
    expect(authBootstrap.initialize).toHaveBeenCalled();
    expect(listingBootstrap.initialize).toHaveBeenCalled();
    expect(authParams.frontendHost).toBe(window.location.hostname);
    expect(authParams.selectedLanguageKey).toBe('selectedLanguage');
    expect(authParams.canEditUsers()).toBeTrue();
    expect(authParams.canMaintainDatabase()).toBeTrue();
    expect(authParams.isAuthenticated()).toBeTrue();
    expect(authParams.getActiveTab()).toBe('MAP_TAB');
    expect(loadUserPreferencesSpy).toHaveBeenCalled();
    expect(loadUsersSpy).toHaveBeenCalled();
    expect(resetGuestStateSpy).toHaveBeenCalled();
    expect(refreshListingDataSpy).toHaveBeenCalledTimes(2);
    expect(appShellState.selectedLanguage()).toBe('sp');
    expect(appShellState.backendBaseUrl()).toBe('http://backend.internal');
    expect(appShellState.staticMediaBaseUrl()).toBe('http://backend.internal/static/images');
    expect(appShellState.googleMapsApiKey()).toBe('maps-key-2');
    expect(appShellState.googleMapsMapId()).toBe('maps-id-2');
    expect(appShellState.googleLoginEnabled()).toBeFalse();
    expect(appShellState.authenticatedUser()).toEqual(user);
    expect(appShellState.activeTab()).toBe('MAP_TAB');
    expect(appShellState.filteredTotalElements()).toBe(17);
  });

  it('ngOnDestroy should teardown listing bootstrap', async () => {
    // Arrange
    const { component, listingBootstrap } = await AppComponentMockFactory.createComponent();

    // Action
    component.ngOnDestroy();

    // Assert
    expect(listingBootstrap.teardown).toHaveBeenCalled();
  });

  [
    {
      methodName: 'onPropertyRowHover',
      invoke: (component: AppComponent, property: ListingPropertyRow) => component.onPropertyRowHover(property),
      expectedSpy: 'onRowHover'
    },
    {
      methodName: 'onPropertyRowClick',
      invoke: (component: AppComponent, property: ListingPropertyRow) => component.onPropertyRowClick(property),
      expectedSpy: 'onRowClick'
    }
  ].forEach(({ methodName, invoke, expectedSpy }) => {
    it(`${methodName} should delegate to PropertySelectionService`, async () => {
      // Arrange
      const { component, propertySelection } = await AppComponentMockFactory.createComponent();
      const property = AppComponentMockFactory.createProperty();

      // Action
      invoke(component, property);

      // Assert
      expect((propertySelection as any)[expectedSpy]).toHaveBeenCalledOnceWith(property);
    });
  });

  [
    {
      methodName: 'onFiltersChange',
      invoke: (component: AppComponent) => component.onFiltersChange(createDefaultListingFilters()),
      privateMethod: 'handleFiltersChange'
    },
    {
      methodName: 'onSortToggle',
      invoke: (component: AppComponent) => component.onSortToggle({ sortBy: 'price' }),
      privateMethod: 'toggleSort'
    },
    {
      methodName: 'onPageChange',
      invoke: (component: AppComponent) => component.onPageChange(3),
      privateMethod: 'changePage'
    },
    {
      methodName: 'onPageSizeChange',
      invoke: (component: AppComponent) => component.onPageSizeChange(500),
      privateMethod: 'changePageSize'
    },
    {
      methodName: 'onPropertyReviewToggle',
      invoke: (component: AppComponent) => component.onPropertyReviewToggle(AppComponentMockFactory.createProperty()),
      privateMethod: 'togglePropertyReview'
    },
    {
      methodName: 'onPropertyCommentSave',
      invoke: (component: AppComponent) => component.onPropertyCommentSave({
        property: AppComponentMockFactory.createProperty(),
        comment: 'comment'
      }),
      privateMethod: 'savePropertyComment'
    }
  ].forEach(({ methodName, invoke, privateMethod }) => {
    it(`${methodName} should delegate to private workflow`, async () => {
      // Arrange
      const { component } = await AppComponentMockFactory.createComponent();
      const privateMethodSpy = spyOn<any>(component, privateMethod).and.resolveTo(undefined);

      // Action
      invoke(component);

      // Assert
      expect(privateMethodSpy).toHaveBeenCalled();
    });
  });

  it('should delegate workspace layout, fullscreen and splitter interactions', async () => {
    // Arrange
    const { component, shellInputInteraction, workspaceInteraction } = await AppComponentMockFactory.createComponent();
    const mouseEvent = new MouseEvent('mousedown');

    // Action
    component.onSplitterMouseDown(mouseEvent);
    component.cycleWorkspaceLayout();
    const workspaceColumns = component.getWorkspaceColumns();
    const cycleIcon = component.getWorkspaceCycleIcon();
    component.onFullscreenRequested();

    // Assert
    expect(shellInputInteraction.onSplitterMouseDown).toHaveBeenCalledOnceWith(mouseEvent);
    expect(workspaceInteraction.cycleLayout).toHaveBeenCalled();
    expect(workspaceColumns).toBe('1fr 8px 1fr');
    expect(cycleIcon).toBe('view_sidebar');
    expect(workspaceInteraction.toggleFullscreen).toHaveBeenCalled();
  });

  it('should delegate tab, language, maintenance, logout and user deletion commands with callback contracts', async () => {
    // Arrange
    const {
      component,
      appShellCommands,
      appShellState,
      userSessionManagement,
      listingQueryOrchestrator
    } = await AppComponentMockFactory.createComponent();
    appShellState.authenticatedUser.set(AppComponentMockFactory.createAuthenticatedUser({
      permissions: ['canEditUsers', 'canMaintainDatabase']
    }));
    const managedUser = AppComponentMockFactory.createAuthUserListItem();
    userSessionManagement.loadUsers.and.callFake(async (params: any) => {
      params.setUsersLoading(true);
      params.setUsers([managedUser]);
      params.setUsersLoading(false);
    });
    listingQueryOrchestrator.refreshListingData.and.resolveTo(undefined);
    const operation = appShellState.maintenanceOperations[0];

    // Action
    component.onTabChange('USERS_TAB');
    const tabParams = appShellCommands.onTabChange.calls.mostRecent().args[0];
    tabParams.setActiveTab('MAP_TAB');
    await tabParams.onLoadUsers();

    component.onLanguageChange('sp');
    const languageParams = appShellCommands.onLanguageChange.calls.mostRecent().args[0];
    languageParams.setSelectedLanguage('en');

    component.onDeleteUserRequested('managed-user-1');
    const deleteParams = appShellCommands.onDeleteUserRequested.calls.mostRecent().args[0];
    deleteParams.setUsersLoading(true);
    await deleteParams.onLoadUsers();

    component.onMaintenanceOperationRequested(operation);
    const maintenanceParams = appShellCommands.onMaintenanceOperationRequested.calls.mostRecent().args[0];
    maintenanceParams.setMaintenanceRunning(true);
    maintenanceParams.setMaintenanceResultText('done');

    component.onLogoutRequested();
    const logoutParams = appShellCommands.onLogoutRequested.calls.mostRecent().args[0];
    expect(logoutParams.getActiveTab()).toBe('MAP_TAB');
    logoutParams.setActiveTab('DASHBOARD');
    logoutParams.setAuthenticatedUser(null);
    logoutParams.onResetGuestState();
    await logoutParams.onRefreshListingData();

    // Assert
    expect(appShellCommands.onTabChange).toHaveBeenCalled();
    expect(appShellCommands.onLanguageChange).toHaveBeenCalled();
    expect(appShellCommands.onMaintenanceOperationRequested).toHaveBeenCalled();
    expect(appShellCommands.onLogoutRequested).toHaveBeenCalled();
    expect(appShellCommands.onDeleteUserRequested).toHaveBeenCalled();
    expect(tabParams.canEditUsers).toBeTrue();
    expect(tabParams.canMaintainDatabase).toBeTrue();
    expect(tabParams.tabId).toBe('USERS_TAB');
    expect(languageParams.pageSize).toBe(appShellState.pagination().pageSize);
    expect(languageParams.isAuthenticated).toBeTrue();
    expect(languageParams.language).toBe('sp');
    expect(maintenanceParams.operation).toBe(operation);
    expect(deleteParams.currentUser?.id).toBe('user-1');
    expect(component.activeTab()).toBe('DASHBOARD');
    expect(component.authenticatedUser()).toBeNull();
    expect(userSessionManagement.loadUsers).toHaveBeenCalledTimes(2);
    expect(component.usersLoading()).toBeFalse();
    expect(component.users()).toEqual([]);
    expect(component.selectedLanguage()).toBe('en');
    expect(component.maintenanceRunning()).toBeTrue();
    expect(component.maintenanceResultText()).toBe('done');
  });

  it('onGoogleLoginRequested should build login URL and navigate browser', async () => {
    // Arrange
    const { component, authFacade } = await AppComponentMockFactory.createComponent();
    const navigateSpy = spyOn<any>(component, 'navigateTo');
    authFacade.buildGoogleLoginUrl.and.returnValue('https://accounts.google.com/o/oauth2/v2/auth');

    // Action
    component.onGoogleLoginRequested();

    // Assert
    expect(authFacade.buildGoogleLoginUrl).toHaveBeenCalledWith(window.location.href);
    expect(navigateSpy).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('navigateTo should delegate to location assigner', async () => {
    // Arrange
    const { component } = await AppComponentMockFactory.createComponent();
    const assignSpy = jasmine.createSpy('assign');
    (component as any).locationRef = { assign: assignSpy };

    // Action
    (component as any).navigateTo('https://accounts.google.com/o/oauth2/v2/auth');

    // Assert
    expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('should delegate window mouse handlers to ShellInputInteractionUseCaseService', async () => {
    // Arrange
    const { component, shellInputInteraction } = await AppComponentMockFactory.createComponent();
    const workspaceContainer = document.createElement('div');
    component.workspaceContainer = new ElementRef(workspaceContainer);
    const moveEvent = new MouseEvent('mousemove');

    // Action
    component.onWindowMouseMove(moveEvent);
    component.onWindowMouseUp();

    // Assert
    expect(shellInputInteraction.onWindowMouseMove).toHaveBeenCalledOnceWith(moveEvent, component.workspaceContainer);
    expect(shellInputInteraction.onWindowMouseUp).toHaveBeenCalled();
  });

  it('onWindowKeyDown should pass keyboard context and support callbacks with and without detail panel', async () => {
    // Arrange
    const { component, appShellState, shellInputInteraction } = await AppComponentMockFactory.createComponent();
    const property = AppComponentMockFactory.createProperty();
    appShellState.allProperties.set([property]);
    appShellState.selectedProperty.set(property);
    appShellState.authenticatedUser.set(AppComponentMockFactory.createAuthenticatedUser());
    const toggleReviewSpy = spyOn<any>(component, 'togglePropertyReview').and.resolveTo(undefined);
    component.listingPropertiesTable = {
      scrollPropertyIntoView: jasmine.createSpy('scrollPropertyIntoView')
    } as any;
    const toggleLocationDialog = jasmine.createSpy('toggleLocationDialog');
    const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

    // Action
    component.onWindowKeyDown(keyEvent);
    const keyboardParams = shellInputInteraction.onWindowKeyDown.calls.mostRecent().args[0];
    keyboardParams.onTogglePropertyReview(property);
    keyboardParams.onTogglePropertyLocationDialog();
    component.propertyDetailPanel = { toggleLocationDialog } as any;
    keyboardParams.onTogglePropertyLocationDialog();

    // Assert
    expect(shellInputInteraction.onWindowKeyDown).toHaveBeenCalled();
    expect(keyboardParams.event).toBe(keyEvent);
    expect(keyboardParams.activeTab).toBe('DASHBOARD');
    expect(keyboardParams.isAuthenticated).toBeTrue();
    expect(keyboardParams.properties).toEqual([property]);
    expect(keyboardParams.selectedProperty).toEqual(property);
    expect(keyboardParams.scroller).toBe(component.listingPropertiesTable);
    expect(toggleReviewSpy).toHaveBeenCalledWith(property);
    expect(toggleLocationDialog).toHaveBeenCalledTimes(1);
  });

  it('loadUsersForManagement should execute user loader callbacks', async () => {
    // Arrange
    const {
      component,
      appShellState,
      userSessionManagement
    } = await AppComponentMockFactory.createComponent();
    const user = AppComponentMockFactory.createAuthUserListItem();
    appShellState.authenticatedUser.set(AppComponentMockFactory.createAuthenticatedUser({ permissions: ['canEditUsers'] }));
    userSessionManagement.loadUsers.and.callFake(async (params: any) => {
      params.setUsersLoading(true);
      params.setUsers([user]);
      params.setUsersLoading(false);
    });

    // Action
    await (component as any).loadUsersForManagement();

    // Assert
    expect(userSessionManagement.loadUsers).toHaveBeenCalled();
    expect(appShellState.usersLoading()).toBeFalse();
    expect(appShellState.users()).toEqual([user]);
  });

  it('refreshListingData should execute orchestrator callbacks including onAfterRefresh', async () => {
    // Arrange
    const {
      component,
      appShellState,
      propertySelection,
      listingQueryOrchestrator
    } = await AppComponentMockFactory.createComponent();
    const property = AppComponentMockFactory.createProperty();
    listingQueryOrchestrator.refreshListingData.and.callFake(async (params: any) => {
      params.getSortCriteria();
      params.getFilters();
      params.getPagination();
      params.setLoading(true);
      params.setCount(3);
      params.setAllProperties([property]);
      params.setPagination({
        page: 2,
        pageSize: 100,
        totalElements: 3,
        totalPages: 1
      });
      params.setFilteredTotalElements(3);
      params.onAfterRefresh();
      params.setLoading(false);
    });

    // Action
    await (component as any).refreshListingData();

    // Assert
    expect(listingQueryOrchestrator.refreshListingData).toHaveBeenCalled();
    expect(propertySelection.syncAfterRefresh).toHaveBeenCalledWith([property]);
    expect(appShellState.loading()).toBeFalse();
    expect(appShellState.count()).toBe(3);
    expect(appShellState.allProperties()).toEqual([property]);
    expect(appShellState.pagination().page).toBe(2);
    expect(appShellState.filteredTotalElements()).toBe(3);
  });

  it('handleFiltersChange should execute orchestrator callbacks', async () => {
    // Arrange
    const { component, appShellState, listingQueryOrchestrator } = await AppComponentMockFactory.createComponent();
    const refreshSpy = spyOn<any>(component, 'refreshListingData').and.resolveTo(undefined);
    const nextFilters = {
      ...createDefaultListingFilters(),
      showClosed: false,
      minPrice: '1000',
      maxPrice: '1800'
    };
    appShellState.pagination.set({
      ...appShellState.pagination(),
      page: 7
    });
    listingQueryOrchestrator.handleFiltersChange.and.callFake(async (params: any) => {
      params.getCurrentFilters();
      params.getSortCriteria();
      params.getPageSize();
      params.getSelectedLanguage();
      params.isAuthenticated();
      params.setFilters(nextFilters);
      params.onResetToFirstPage();
      await params.onRefreshListingData();
    });

    // Action
    await (component as any).handleFiltersChange(nextFilters);

    // Assert
    expect(listingQueryOrchestrator.handleFiltersChange).toHaveBeenCalled();
    expect(appShellState.filters()).toEqual(nextFilters);
    expect(appShellState.pagination().page).toBe(1);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('loadUserPreferences should execute orchestrator callbacks', async () => {
    // Arrange
    const {
      component,
      appShellState,
      listingStateFacade,
      listingQueryOrchestrator
    } = await AppComponentMockFactory.createComponent();
    const filters = {
      ...createDefaultListingFilters(),
      showFavourite: false
    };
    const labels: PropertyLabelEntry[] = [
      { propertyId: 'property-1', labels: { review: 'FAVOURITE', comment: 'hello' } }
    ];
    listingQueryOrchestrator.loadUserPreferences.and.callFake(async (params: any) => {
      params.setSelectedLanguage('sp');
      params.persistSelectedLanguage('sp');
      params.setFilters(filters);
      params.setSortCriteria([{ sortBy: 'price', sortOrder: 'asc' }]);
      params.setPageSize(500);
      params.setPropertyLabels(labels);
      params.setFilteredTotalElements(25);
    });

    // Action
    await (component as any).loadUserPreferences();

    // Assert
    expect(listingQueryOrchestrator.loadUserPreferences).toHaveBeenCalled();
    expect(listingStateFacade.persistSelectedLanguage).toHaveBeenCalledWith('selectedLanguage', 'sp');
    expect(appShellState.selectedLanguage()).toBe('sp');
    expect(appShellState.filters()).toEqual(filters);
    expect(appShellState.sortCriteria()).toEqual([{ sortBy: 'price', sortOrder: 'asc' }]);
    expect(appShellState.pagination().pageSize).toBe(500);
    expect(appShellState.propertyLabels()).toEqual(labels);
    expect(appShellState.filteredTotalElements()).toBe(25);
  });

  it('togglePropertyReview and savePropertyComment should execute interaction callbacks', async () => {
    // Arrange
    const {
      component,
      appShellState,
      listingInteractionUseCase
    } = await AppComponentMockFactory.createComponent();
    const property = AppComponentMockFactory.createProperty({ propertyId: 'property-9' });
    appShellState.authenticatedUser.set(AppComponentMockFactory.createAuthenticatedUser());
    appShellState.propertyLabels.set([{ propertyId: 'property-9', labels: { review: 'NEW' } }]);
    listingInteractionUseCase.togglePropertyReview.and.callFake(async (params: any) => {
      params.getPropertyLabels();
      params.setPropertyLabels([{ propertyId: params.propertyId, labels: { review: 'FAVOURITE' } }]);
    });
    listingInteractionUseCase.savePropertyComment.and.callFake(async (params: any) => {
      const current = params.getPropertyLabels();
      params.setPropertyLabels([
        ...current,
        { propertyId: params.propertyId, labels: { comment: params.commentRaw } }
      ]);
    });

    // Action
    await (component as any).togglePropertyReview(property);
    await (component as any).savePropertyComment(property, 'new comment');

    // Assert
    expect(listingInteractionUseCase.togglePropertyReview).toHaveBeenCalled();
    expect(listingInteractionUseCase.savePropertyComment).toHaveBeenCalled();
    expect(appShellState.propertyLabels()).toEqual([
      { propertyId: 'property-9', labels: { review: 'FAVOURITE' } },
      { propertyId: 'property-9', labels: { comment: 'new comment' } }
    ]);
  });

  it('toggleSort, changePage and changePageSize should execute orchestrator callbacks', async () => {
    // Arrange
    const { component, appShellState, listingQueryOrchestrator } = await AppComponentMockFactory.createComponent();
    const refreshSpy = spyOn<any>(component, 'refreshListingData').and.resolveTo(undefined);
    appShellState.pagination.set({
      page: 4,
      pageSize: 100,
      totalElements: 1000,
      totalPages: 10
    });
    listingQueryOrchestrator.toggleSort.and.callFake(async (params: any) => {
      params.getSortCriteria();
      params.getFilters();
      params.getPageSize();
      params.getSelectedLanguage();
      params.isAuthenticated();
      params.setSortCriteria([{ sortBy: params.sortBy, sortOrder: 'desc' }]);
      params.onResetToFirstPage();
      await params.onRefreshListingData();
    });
    listingQueryOrchestrator.changePage.and.callFake(async (params: any) => {
      params.getPagination();
      params.setPage(6);
      await params.onRefreshListingData();
    });
    listingQueryOrchestrator.changePageSize.and.callFake(async (params: any) => {
      params.getFilters();
      params.getSortCriteria();
      params.getSelectedLanguage();
      params.isAuthenticated();
      params.setPagination({
        ...params.getPagination(),
        page: 1,
        pageSize: 500
      });
      await params.onRefreshListingData();
    });

    // Action
    await (component as any).toggleSort('title');
    await (component as any).changePage(6);
    await (component as any).changePageSize(500);

    // Assert
    expect(listingQueryOrchestrator.toggleSort).toHaveBeenCalled();
    expect(listingQueryOrchestrator.changePage).toHaveBeenCalled();
    expect(listingQueryOrchestrator.changePageSize).toHaveBeenCalled();
    expect(appShellState.sortCriteria()).toEqual([{ sortBy: 'title', sortOrder: 'desc' }]);
    expect(appShellState.pagination().page).toBe(1);
    expect(appShellState.pagination().pageSize).toBe(500);
    expect(refreshSpy).toHaveBeenCalledTimes(3);
  });

  it('resetGuestState should restore guest defaults and persist filtered total elements', async () => {
    // Arrange
    const { component, appShellState, listingQueryOrchestrator } = await AppComponentMockFactory.createComponent();
    appShellState.users.set([AppComponentMockFactory.createAuthUserListItem()]);
    appShellState.filters.set({
      ...createDefaultListingFilters(),
      showClosed: false,
      minPrice: '1400'
    });
    appShellState.pagination.set({
      page: 9,
      pageSize: 500,
      totalElements: 900,
      totalPages: 9
    });
    appShellState.sortCriteria.set([{ sortBy: 'price', sortOrder: 'asc' }]);
    appShellState.propertyLabels.set([{ propertyId: 'property-1', labels: { review: 'DISCHARGED' } }]);
    listingQueryOrchestrator.persistFilteredTotalElementsInSession.and.callFake((totalElements: number, setFilteredTotalElements: (value: number) => void) => {
      setFilteredTotalElements(totalElements);
    });

    // Action
    (component as any).resetGuestState();

    // Assert
    expect(listingQueryOrchestrator.persistFilteredTotalElementsInSession).toHaveBeenCalledWith(0, jasmine.any(Function));
    expect(appShellState.users()).toEqual([]);
    expect(appShellState.filters()).toEqual(createDefaultListingFilters());
    expect(appShellState.pagination()).toEqual(createDefaultListingPaginationState());
    expect(appShellState.sortCriteria()).toEqual([]);
    expect(appShellState.propertyLabels()).toEqual([]);
    expect(appShellState.filteredTotalElements()).toBe(0);
  });
});
