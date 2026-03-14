import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ApiRuntimeConfigService } from 'src/app/api/api-runtime-config.service';
import { AuthUserListItem } from 'src/app/dashboard/auth/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { DashboardUsersPanelComponent } from 'src/app/dashboard/auth/components/dashboard-users-panel.component';
import { DashboardMaintenancePanelComponent } from 'src/app/dashboard/components/dashboard-maintenance-panel.component';
import { DashboardPropertiesTableComponent } from 'src/app/dashboard/components/dashboard-properties-table.component';
import { DashboardTopBarComponent } from 'src/app/dashboard/components/dashboard-top-bar.component';
import {
  DashboardFiltersState,
  createDefaultDashboardFilters
} from 'src/app/dashboard/filters/dashboard-filters.model';
import {
  PropertyLabelEntry,
  DashboardPropertyRow,
  DashboardTab,
  SortCriterion,
  SortToggleRequest
} from 'src/app/dashboard/dashboard.types';
import { PropertySelectionService } from 'src/app/dashboard/services/property-selection.service';
import { DashboardAuthFacadeService } from 'src/app/dashboard/shell/services/dashboard-auth-facade.service';
import { DashboardDataCoordinatorService } from 'src/app/dashboard/shell/services/dashboard-data-coordinator.service';
import { DashboardStateFacadeService } from 'src/app/dashboard/shell/services/dashboard-state-facade.service';
import { PropertyLabelsFacadeService } from 'src/app/dashboard/shell/services/property-labels-facade.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/dashboard/shell/services/workspace-interaction-coordinator.service';
import { AuthBootstrapUseCaseService } from 'src/app/dashboard/shell/use-cases/auth-bootstrap.use-case.service';
import { DashboardBootstrapUseCaseService } from 'src/app/dashboard/shell/use-cases/dashboard-bootstrap.use-case.service';
import { KeyboardFlowUseCaseService } from 'src/app/dashboard/shell/use-cases/keyboard-flow.use-case.service';
import { UserSessionManagementUseCaseService } from 'src/app/dashboard/shell/use-cases/user-session-management.use-case.service';
import { DatabaseMaintenanceOperation } from 'src/app/databasemaintenance/database-maintenance-operation';
import { RemoveDanglingImagesOperation } from 'src/app/databasemaintenance/remove-dangling-images.operation';
import { SupportedLanguage } from 'src/app/i18n/i18n.service';
import { PropertyDetailPanelComponent } from 'src/app/propertydetail/property-detail-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    DashboardTopBarComponent,
    DashboardPropertiesTableComponent,
    DashboardMaintenancePanelComponent,
    DashboardUsersPanelComponent,
    PropertyDetailPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';

  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboardAuthFacadeService = inject(DashboardAuthFacadeService);
  private readonly dashboardStateFacadeService = inject(DashboardStateFacadeService);
  private readonly dashboardDataCoordinatorService = inject(DashboardDataCoordinatorService);
  private readonly propertyLabelsFacadeService = inject(PropertyLabelsFacadeService);
  private readonly workspaceInteractionCoordinatorService = inject(WorkspaceInteractionCoordinatorService);
  private readonly authBootstrapUseCaseService = inject(AuthBootstrapUseCaseService);
  private readonly dashboardBootstrapUseCaseService = inject(DashboardBootstrapUseCaseService);
  private readonly keyboardFlowUseCaseService = inject(KeyboardFlowUseCaseService);
  private readonly userSessionManagementUseCaseService = inject(UserSessionManagementUseCaseService);
  private readonly propertySelectionService = inject(PropertySelectionService);

  private backendBaseUrl = ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL;
  private staticMediaBaseUrl = ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL;

  @ViewChild('workspaceContainer') workspaceContainer?: ElementRef<HTMLDivElement>;
  @ViewChild(DashboardPropertiesTableComponent) dashboardPropertiesTable?: DashboardPropertiesTableComponent;

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly allProperties = signal<DashboardPropertyRow[]>([]);
  readonly filters = signal<DashboardFiltersState>(createDefaultDashboardFilters());
  readonly properties = computed<DashboardPropertyRow[]>(() => this.allProperties());
  readonly visibleCount = computed<number>(() => this.properties().length);
  readonly selectedProperty = this.propertySelectionService.selectedProperty;
  readonly lockedSelectedPropertyKey = this.propertySelectionService.lockedSelectedPropertyKey;
  readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly activeTab = signal<DashboardTab>('DASHBOARD');
  readonly googleLoginEnabled = signal<boolean>(true);
  readonly authenticatedUser = signal<AuthenticatedUser | null>(null);
  readonly canEditUsers = computed<boolean>(() =>
    this.authenticatedUser()?.permissions?.includes('canEditUsers') === true
  );
  readonly canMaintainDatabase = computed<boolean>(() =>
    this.authenticatedUser()?.permissions?.includes('canMaintainDatabase') === true
  );
  readonly authenticatedUserAvatarUrl = computed<string | null>(() =>
    this.authenticatedUser() ? `${this.backendBaseUrl}/auth/google/avatar` : null
  );
  readonly users = signal<AuthUserListItem[]>([]);
  readonly usersLoading = signal<boolean>(false);
  readonly propertyLabels = signal<PropertyLabelEntry[]>([]);
  readonly maintenanceOperations: DatabaseMaintenanceOperation[] = [
    new RemoveDanglingImagesOperation()
  ];
  readonly maintenanceRunning = signal<boolean>(false);
  readonly maintenanceResultText = signal<string>('');
  readonly sortCriteria = signal<SortCriterion[]>([]);
  readonly leftPanelWidthPercent = this.workspaceInteractionCoordinatorService.leftPanelWidthPercent;
  readonly leftPanelHidden = this.workspaceInteractionCoordinatorService.leftPanelHidden;
  readonly rightPanelHidden = this.workspaceInteractionCoordinatorService.rightPanelHidden;

  async ngOnInit(): Promise<void> {
    await this.authBootstrapUseCaseService.initialize({
      http: this.http,
      destroyRef: this.destroyRef,
      frontendHost: window.location.hostname,
      selectedLanguageKey: AppComponent.SELECTED_LANGUAGE_KEY,
      setSelectedLanguage: (language) => this.selectedLanguage.set(language),
      setBackendBaseUrl: (backendBaseUrl) => {
        this.backendBaseUrl = backendBaseUrl;
      },
      setStaticMediaBaseUrl: (staticMediaBaseUrl) => {
        this.staticMediaBaseUrl = staticMediaBaseUrl;
      },
      setGoogleLoginEnabled: (enabled) => this.googleLoginEnabled.set(enabled),
      activeTab: this.activeTab(),
      canMaintainDatabase: () => this.canMaintainDatabase(),
      canEditUsers: () => this.canEditUsers(),
      setAuthenticatedUser: (user) => this.authenticatedUser.set(user),
      setActiveTab: (tab) => this.activeTab.set(tab),
      onLoadUserPreferences: () => this.loadUserPreferences(),
      onLoadUsers: () => this.loadUsersForManagement(),
      onResetGuestState: () => this.resetGuestState(),
      isAuthenticated: () => this.authenticatedUser() !== null,
      getActiveTab: () => this.activeTab(),
      onRefreshDashboardData: () => this.refreshDashboardData()
    });

    await this.dashboardBootstrapUseCaseService.initialize({
      onRefreshDashboardData: () => this.refreshDashboardData()
    });
  }

  ngOnDestroy(): void {
    this.dashboardBootstrapUseCaseService.teardown();
  }

  onTabChange(tabId: DashboardTab): void {
    if (tabId === 'USERS_TAB' && !this.canEditUsers()) {
      this.activeTab.set('DASHBOARD');
      return;
    }
    if (tabId === 'DATABASE_MAINTENANCE_TAB' && !this.canMaintainDatabase()) {
      this.activeTab.set('DASHBOARD');
      return;
    }

    this.activeTab.set(tabId);
    if (tabId === 'USERS_TAB') {
      void this.loadUsersForManagement();
    }
  }

  onLanguageChange(language: SupportedLanguage): void {
    this.selectedLanguage.set(language);
    this.dashboardStateFacadeService.persistSelectedLanguage(AppComponent.SELECTED_LANGUAGE_KEY, language);
  }

  onFiltersChange(filters: DashboardFiltersState): void {
    void this.handleFiltersChange(filters);
  }

  onSortToggle(request: SortToggleRequest): void {
    void this.toggleSort(request.sortBy);
  }

  onPropertyRowHover(property: DashboardPropertyRow): void {
    this.propertySelectionService.onRowHover(property);
  }

  onPropertyRowClick(property: DashboardPropertyRow): void {
    this.propertySelectionService.onRowClick(property);
  }

  onPropertyReviewToggle(property: DashboardPropertyRow): void {
    void this.togglePropertyReview(property);
  }

  onPropertyCommentSave(event: { property: DashboardPropertyRow; comment: string }): void {
    void this.savePropertyComment(event.property, event.comment);
  }

  onSplitterMouseDown(event: MouseEvent): void {
    this.workspaceInteractionCoordinatorService.startResize(event);
  }

  cycleWorkspaceLayout(): void {
    this.workspaceInteractionCoordinatorService.cycleLayout();
  }

  getWorkspaceColumns(): string {
    return this.workspaceInteractionCoordinatorService.getWorkspaceColumns();
  }

  getWorkspaceCycleIcon(): string {
    return this.workspaceInteractionCoordinatorService.getCycleIcon();
  }

  onMaintenanceOperationRequested(operation: DatabaseMaintenanceOperation): void {
    void this.runDatabaseMaintenanceOperation(operation);
  }

  getStaticMediaBaseUrl(): string {
    return this.staticMediaBaseUrl;
  }

  onFullscreenRequested(): void {
    this.workspaceInteractionCoordinatorService.toggleFullscreen();
  }

  onGoogleLoginRequested(): void {
    const loginUrl = this.dashboardAuthFacadeService.buildGoogleLoginUrl(window.location.href);
    window.location.assign(loginUrl);
  }

  onLogoutRequested(): void {
    void this.userSessionManagementUseCaseService.logoutCurrentUser({
      http: this.http,
      getActiveTab: () => this.activeTab(),
      setActiveTab: (tab) => this.activeTab.set(tab),
      setAuthenticatedUser: (user) => this.authenticatedUser.set(user),
      onResetGuestState: () => this.resetGuestState(),
      onRefreshDashboardData: () => this.refreshDashboardData()
    });
  }

  onDeleteUserRequested(userId: string): void {
    void this.userSessionManagementUseCaseService.deleteUserAndRefresh({
      http: this.http,
      userId,
      canEditUsers: this.canEditUsers(),
      currentUser: this.authenticatedUser(),
      setUsersLoading: (loading) => this.usersLoading.set(loading),
      onLoadUsers: () => this.loadUsersForManagement()
    });
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    this.workspaceInteractionCoordinatorService.handleWindowMouseMove(
      event,
      this.workspaceContainer?.nativeElement ?? null
    );
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.workspaceInteractionCoordinatorService.handleWindowMouseUp();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    this.keyboardFlowUseCaseService.handleWindowKeyDown({
      event,
      activeTab: this.activeTab(),
      isAuthenticated: this.authenticatedUser() !== null,
      properties: this.properties(),
      selectedProperty: this.selectedProperty(),
      onTogglePropertyReview: (property) => {
        void this.togglePropertyReview(property);
      },
      scroller: this.dashboardPropertiesTable
    });
  }

  private async loadUsersForManagement(): Promise<void> {
    await this.userSessionManagementUseCaseService.loadUsers({
      http: this.http,
      canEditUsers: this.canEditUsers(),
      setUsersLoading: (loading) => this.usersLoading.set(loading),
      setUsers: (users) => this.users.set(users)
    });
  }

  private async refreshDashboardData(): Promise<void> {
    await this.dashboardDataCoordinatorService.refreshDashboardData({
      http: this.http,
      sortCriteria: this.sortCriteria(),
      filters: this.filters(),
      setLoading: (loading) => this.loading.set(loading),
      setCount: (count) => this.count.set(count),
      setAllProperties: (properties) => this.allProperties.set(properties),
      onAfterRefresh: () => this.propertySelectionService.syncAfterRefresh(this.properties())
    });
  }

  private async handleFiltersChange(filters: DashboardFiltersState): Promise<void> {
    await this.dashboardDataCoordinatorService.handleFiltersChange({
      http: this.http,
      currentFilters: this.filters(),
      nextFilters: filters,
      isAuthenticated: this.authenticatedUser() !== null,
      setFilters: (nextFilters) => this.filters.set(nextFilters),
      onRefreshDashboardData: () => this.refreshDashboardData()
    });
  }

  private async loadUserPreferences(): Promise<void> {
    await this.dashboardDataCoordinatorService.loadUserPreferences({
      http: this.http,
      setFilters: (filters) => this.filters.set(filters),
      setPropertyLabels: (labels) => this.propertyLabels.set(labels)
    });
  }

  private async togglePropertyReview(property: DashboardPropertyRow): Promise<void> {
    if (!this.authenticatedUser()) {
      return;
    }

    try {
      const updatedLabels = await this.propertyLabelsFacadeService.togglePropertyReview(
        this.http,
        property.propertyId,
        this.propertyLabels()
      );
      this.propertyLabels.set(updatedLabels);
    } catch {
      // Ignore API errors; UI state remains unchanged.
    }
  }

  private async savePropertyComment(property: DashboardPropertyRow, commentRaw: string): Promise<void> {
    if (!this.authenticatedUser()) {
      return;
    }

    try {
      const updatedLabels = await this.propertyLabelsFacadeService.savePropertyComment(
        this.http,
        property.propertyId,
        commentRaw,
        this.propertyLabels()
      );
      if (updatedLabels) {
        this.propertyLabels.set(updatedLabels);
      }
    } catch {
      // Ignore API errors; UI state remains unchanged.
    }
  }

  private async toggleSort(sortBy: SortToggleRequest['sortBy']): Promise<void> {
    await this.dashboardDataCoordinatorService.toggleSortAndRefresh({
      currentSortCriteria: this.sortCriteria(),
      sortBy,
      setSortCriteria: (criteria) => this.sortCriteria.set(criteria),
      onRefreshDashboardData: () => this.refreshDashboardData()
    });
  }

  private async runDatabaseMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<void> {
    await this.dashboardDataCoordinatorService.runMaintenanceOperation({
      operation,
      http: this.http,
      setMaintenanceRunning: (running) => this.maintenanceRunning.set(running),
      setMaintenanceResultText: (text) => this.maintenanceResultText.set(text)
    });
  }

  private resetGuestState(): void {
    this.users.set([]);
    this.filters.set(createDefaultDashboardFilters());
    this.propertyLabels.set([]);
  }
}
