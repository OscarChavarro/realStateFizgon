import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { AuthUserListItem } from 'src/app/dashboard/auth/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { DashboardUsersPanelComponent } from 'src/app/dashboard/auth/components/dashboard-users-panel.component';
import { DashboardDataService } from 'src/app/dashboard/dashboard-data.service';
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
import { DashboardSessionCoordinatorService } from 'src/app/dashboard/shell/services/dashboard-session-coordinator.service';
import { DashboardStateFacadeService } from 'src/app/dashboard/shell/services/dashboard-state-facade.service';
import { PropertyLabelsFacadeService } from 'src/app/dashboard/shell/services/property-labels-facade.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/dashboard/shell/services/workspace-interaction-coordinator.service';
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
  private readonly dashboardAuthFacadeService = inject(DashboardAuthFacadeService);
  private readonly dashboardStateFacadeService = inject(DashboardStateFacadeService);
  private readonly dashboardSessionCoordinatorService = inject(DashboardSessionCoordinatorService);
  private readonly dashboardDataCoordinatorService = inject(DashboardDataCoordinatorService);
  private readonly propertyLabelsFacadeService = inject(PropertyLabelsFacadeService);
  private readonly workspaceInteractionCoordinatorService = inject(WorkspaceInteractionCoordinatorService);
  private readonly propertySelectionService = inject(PropertySelectionService);

  private backendBaseUrl = DashboardDataService.DEFAULT_BACKEND_BASE_URL;
  private staticMediaBaseUrl = DashboardDataService.DEFAULT_STATIC_MEDIA_BASE_URL;

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
    this.selectedLanguage.set(
      this.dashboardStateFacadeService.loadSelectedLanguageFromSession(AppComponent.SELECTED_LANGUAGE_KEY)
    );
    await this.loadBackendConfiguration();
    await this.loadGoogleLoginAvailability();
    await this.loadCurrentUser();
    await this.refreshDashboardData();
    this.workspaceInteractionCoordinatorService.connectUpdatesSocket(
      this.backendBaseUrl,
      async () => this.refreshDashboardData()
    );
  }

  ngOnDestroy(): void {
    this.workspaceInteractionCoordinatorService.disconnectUpdatesSocket();
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
      void this.loadUsers();
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
    void this.toggleSort(request.sortBy, request.sortOrder);
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
    const loginUrl = this.dashboardAuthFacadeService.buildGoogleLoginUrl(this.backendBaseUrl, window.location.href);
    window.location.assign(loginUrl);
  }

  onLogoutRequested(): void {
    void this.logoutCurrentUser();
  }

  onDeleteUserRequested(userId: string): void {
    void this.deleteUserAndRefresh(userId);
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
    this.workspaceInteractionCoordinatorService.handleWindowKeyDown({
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

  private async loadBackendConfiguration(): Promise<void> {
    const config = await this.dashboardStateFacadeService.loadBackendConfiguration(this.http);
    this.backendBaseUrl = config.backendBaseUrl;
    this.staticMediaBaseUrl = config.staticMediaBaseUrl;
    this.dashboardAuthFacadeService.warnIfAuthHostMismatch(
      this.backendBaseUrl,
      window.location.hostname
    );
  }

  private async loadGoogleLoginAvailability(): Promise<void> {
    const enabled = await this.dashboardAuthFacadeService.loadGoogleLoginAvailability(this.http, this.backendBaseUrl);
    this.googleLoginEnabled.set(enabled);
  }

  private async loadCurrentUser(): Promise<void> {
    await this.dashboardSessionCoordinatorService.loadCurrentUserAndApplyState({
      http: this.http,
      backendBaseUrl: this.backendBaseUrl,
      activeTab: this.activeTab(),
      canMaintainDatabase: () => this.canMaintainDatabase(),
      canEditUsers: () => this.canEditUsers(),
      setAuthenticatedUser: (user) => this.authenticatedUser.set(user),
      setActiveTab: (tab) => this.activeTab.set(tab),
      onLoadUserPreferences: () => this.loadUserPreferences(),
      onLoadUsers: () => this.loadUsers(),
      onResetGuestState: () => this.resetGuestState()
    });
  }

  private async logoutCurrentUser(): Promise<void> {
    await this.dashboardSessionCoordinatorService.logoutAndReset({
      http: this.http,
      backendBaseUrl: this.backendBaseUrl,
      setAuthenticatedUser: (user) => this.authenticatedUser.set(user),
      onResetGuestState: () => {
        this.resetGuestState();
        if (this.activeTab() === 'USERS_TAB' || this.activeTab() === 'DATABASE_MAINTENANCE_TAB') {
          this.activeTab.set('DASHBOARD');
        }
      },
      onRefreshDashboardData: () => this.refreshDashboardData()
    });
  }

  private async loadUsers(): Promise<void> {
    await this.dashboardSessionCoordinatorService.loadUsers({
      http: this.http,
      backendBaseUrl: this.backendBaseUrl,
      canEditUsers: this.canEditUsers(),
      setUsersLoading: (loading) => this.usersLoading.set(loading),
      setUsers: (users) => this.users.set(users)
    });
  }

  private async deleteUserAndRefresh(userId: string): Promise<void> {
    await this.dashboardSessionCoordinatorService.deleteUserAndRefresh({
      http: this.http,
      backendBaseUrl: this.backendBaseUrl,
      userId,
      canEditUsers: this.canEditUsers(),
      currentUser: this.authenticatedUser(),
      setUsersLoading: (loading) => this.usersLoading.set(loading),
      onLoadUsers: () => this.loadUsers()
    });
  }

  private async refreshDashboardData(): Promise<void> {
    await this.dashboardDataCoordinatorService.refreshDashboardData({
      http: this.http,
      backendBaseUrl: this.backendBaseUrl,
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
      backendBaseUrl: this.backendBaseUrl,
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
      backendBaseUrl: this.backendBaseUrl,
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
        this.backendBaseUrl,
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
        this.backendBaseUrl,
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

  private async toggleSort(sortBy: SortToggleRequest['sortBy'], sortOrder: SortToggleRequest['sortOrder']): Promise<void> {
    await this.dashboardDataCoordinatorService.toggleSortAndRefresh({
      currentSortCriteria: this.sortCriteria(),
      sortBy,
      sortOrder,
      setSortCriteria: (criteria) => this.sortCriteria.set(criteria),
      onRefreshDashboardData: () => this.refreshDashboardData()
    });
  }

  private async runDatabaseMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<void> {
    await this.dashboardDataCoordinatorService.runMaintenanceOperation({
      operation,
      http: this.http,
      backendBaseUrl: this.backendBaseUrl,
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
