import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { UsersPanelComponent } from 'src/app/auth/components/users-panel/users-panel.component';
import { MaintenancePanelComponent } from 'src/app/maintenance/components/maintenance-panel/maintenance-panel.component';
import { ListingPropertiesTableComponent } from 'src/app/listing/components/listing-properties-table/listing-properties-table.component';
import { ListingTopBarComponent } from 'src/app/listing/components/listing-top-bar/listing-top-bar.component';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import {
  PropertyLabelEntry,
  ListingPropertyRow,
  ListingTab,
  SortCriterion,
  SortToggleRequest
} from 'src/app/listing/model/listing.types';
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  createDefaultListingPaginationState
} from 'src/app/listing/model/pagination/listing-pagination.model';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { PropertyLabelsFacadeService } from 'src/app/prefs/services/property-labels-facade.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';
import { AuthBootstrapUseCaseService } from 'src/app/auth/services/auth-bootstrap.use-case.service';
import { ListingBootstrapUseCaseService } from 'src/app/listing/services/listing-bootstrap.use-case.service';
import { KeyboardFlowUseCaseService } from 'src/app/listing/services/keyboard-flow.use-case.service';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { PropertyDetailPanelComponent } from 'src/app/property/components/property-detail-panel/property-detail-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ListingTopBarComponent,
    ListingPropertiesTableComponent,
    MaintenancePanelComponent,
    UsersPanelComponent,
    PropertyDetailPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';
  private static readonly FILTERED_TOTAL_ELEMENTS_KEY = 'filteredTotalElements';

  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listingAuthFacadeService = inject(AuthFacadeService);
  private readonly listingStateFacadeService = inject(ListingStateFacadeService);
  private readonly listingDataCoordinatorService = inject(ListingDataCoordinatorService);
  private readonly propertyLabelsFacadeService = inject(PropertyLabelsFacadeService);
  private readonly workspaceInteractionCoordinatorService = inject(WorkspaceInteractionCoordinatorService);
  private readonly authBootstrapUseCaseService = inject(AuthBootstrapUseCaseService);
  private readonly listingBootstrapUseCaseService = inject(ListingBootstrapUseCaseService);
  private readonly keyboardFlowUseCaseService = inject(KeyboardFlowUseCaseService);
  private readonly userSessionManagementUseCaseService = inject(UserSessionManagementUseCaseService);
  private readonly propertySelectionService = inject(PropertySelectionService);

  private backendBaseUrl = ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL;
  private staticMediaBaseUrl = ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL;
  private googleMapsApiKey: string | null = null;
  private googleMapsMapId: string | null = null;

  @ViewChild('workspaceContainer') workspaceContainer?: ElementRef<HTMLDivElement>;
  @ViewChild(ListingPropertiesTableComponent) listingPropertiesTable?: ListingPropertiesTableComponent;

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly allProperties = signal<ListingPropertyRow[]>([]);
  readonly filters = signal<ListingFiltersState>(createDefaultListingFilters());
  readonly pagination = signal(createDefaultListingPaginationState());
  readonly properties = computed<ListingPropertyRow[]>(() => this.allProperties());
  readonly filteredTotalElements = signal<number>(this.readFilteredTotalElementsFromSession());
  readonly visibleCount = computed<number>(() => this.filteredTotalElements());
  readonly selectedProperty = this.propertySelectionService.selectedProperty;
  readonly lockedSelectedPropertyKey = this.propertySelectionService.lockedSelectedPropertyKey;
  readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly activeTab = signal<ListingTab>('DASHBOARD');
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
      setGoogleMapsApiKey: (googleMapsApiKey) => {
        this.googleMapsApiKey = googleMapsApiKey;
      },
      setGoogleMapsMapId: (googleMapsMapId) => {
        this.googleMapsMapId = googleMapsMapId;
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
      onRefreshListingData: () => this.refreshListingData()
    });

    await this.listingBootstrapUseCaseService.initialize({
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  ngOnDestroy(): void {
    this.listingBootstrapUseCaseService.teardown();
  }

  onTabChange(tabId: ListingTab): void {
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
    this.listingStateFacadeService.persistSelectedLanguage(AppComponent.SELECTED_LANGUAGE_KEY, language);
    void this.listingDataCoordinatorService.saveLanguagePreference(
      this.http,
      this.authenticatedUser() !== null,
      this.filters(),
      this.sortCriteria(),
      this.pagination().pageSize,
      language
    );
  }

  onFiltersChange(filters: ListingFiltersState): void {
    void this.handleFiltersChange(filters);
  }

  onSortToggle(request: SortToggleRequest): void {
    void this.toggleSort(request.sortBy);
  }

  onPageChange(page: number): void {
    void this.changePage(page);
  }

  onPageSizeChange(pageSize: number): void {
    void this.changePageSize(pageSize);
  }

  onPropertyRowHover(property: ListingPropertyRow): void {
    this.propertySelectionService.onRowHover(property);
  }

  onPropertyRowClick(property: ListingPropertyRow): void {
    this.propertySelectionService.onRowClick(property);
  }

  onPropertyReviewToggle(property: ListingPropertyRow): void {
    void this.togglePropertyReview(property);
  }

  onPropertyCommentSave(event: { property: ListingPropertyRow; comment: string }): void {
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

  getGoogleMapsApiKey(): string | null {
    return this.googleMapsApiKey;
  }

  getGoogleMapsMapId(): string | null {
    return this.googleMapsMapId;
  }

  onFullscreenRequested(): void {
    this.workspaceInteractionCoordinatorService.toggleFullscreen();
  }

  onGoogleLoginRequested(): void {
    const loginUrl = this.listingAuthFacadeService.buildGoogleLoginUrl(window.location.href);
    window.location.assign(loginUrl);
  }

  onLogoutRequested(): void {
    void this.userSessionManagementUseCaseService.logoutCurrentUser({
      http: this.http,
      getActiveTab: () => this.activeTab(),
      setActiveTab: (tab) => this.activeTab.set(tab),
      setAuthenticatedUser: (user) => this.authenticatedUser.set(user),
      onResetGuestState: () => this.resetGuestState(),
      onRefreshListingData: () => this.refreshListingData()
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
      scroller: this.listingPropertiesTable
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

  private async refreshListingData(): Promise<void> {
    const requestPageSize = this.resolveRequestPageSize(this.pagination().pageSize);
    const requestPage = requestPageSize > 0 ? this.pagination().page : 1;
    const requestPagination = {
      ...this.pagination(),
      page: requestPage,
      pageSize: requestPageSize
    };
    await this.listingDataCoordinatorService.refreshListingData({
      http: this.http,
      sortCriteria: this.sortCriteria(),
      filters: this.filters(),
      pagination: requestPagination,
      setLoading: (loading) => this.loading.set(loading),
      setCount: (count) => this.count.set(count),
      setAllProperties: (properties) => this.allProperties.set(properties),
      setPagination: (pagination) => {
        this.pagination.set(pagination);
        this.persistFilteredTotalElementsInSession(pagination.totalElements);
      },
      onAfterRefresh: () => this.propertySelectionService.syncAfterRefresh(this.properties())
    });
  }

  private async handleFiltersChange(filters: ListingFiltersState): Promise<void> {
    await this.listingDataCoordinatorService.handleFiltersChange({
      http: this.http,
      currentFilters: this.filters(),
      nextFilters: filters,
      sortCriteria: this.sortCriteria(),
      pageSize: this.pagination().pageSize,
      selectedLanguage: this.selectedLanguage(),
      isAuthenticated: this.authenticatedUser() !== null,
      setFilters: (nextFilters) => this.filters.set(nextFilters),
      onFiltersChanged: () => {
        this.pagination.update((current) => ({
          ...current,
          page: 1
        }));
      },
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  private async loadUserPreferences(): Promise<void> {
    // Prevent stale session totals from clamping the restored page size before first data refresh.
    this.persistFilteredTotalElementsInSession(0);
    await this.listingDataCoordinatorService.loadUserPreferences({
      http: this.http,
      setSelectedLanguage: (language) => this.selectedLanguage.set(language),
      persistSelectedLanguage: (language) => this.listingStateFacadeService.persistSelectedLanguage(
        AppComponent.SELECTED_LANGUAGE_KEY,
        language
      ),
      setFilters: (filters) => this.filters.set(filters),
      setSortCriteria: (criteria) => this.sortCriteria.set(criteria),
      setPageSize: (pageSize) => {
        this.pagination.update((current) => ({
          ...current,
          pageSize
        }));
      },
      setPropertyLabels: (labels) => this.propertyLabels.set(labels)
    });
  }

  private async togglePropertyReview(property: ListingPropertyRow): Promise<void> {
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

  private async savePropertyComment(property: ListingPropertyRow, commentRaw: string): Promise<void> {
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
    this.pagination.update((current) => ({
      ...current,
      page: 1
    }));
    await this.listingDataCoordinatorService.toggleSortAndRefresh({
      http: this.http,
      currentSortCriteria: this.sortCriteria(),
      sortBy,
      filters: this.filters(),
      pageSize: this.pagination().pageSize,
      selectedLanguage: this.selectedLanguage(),
      isAuthenticated: this.authenticatedUser() !== null,
      setSortCriteria: (criteria) => this.sortCriteria.set(criteria),
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  private async changePage(page: number): Promise<void> {
    const current = this.pagination();
    const totalPages = current.totalPages;
    let normalized = Number.isFinite(page) ? Math.floor(page) : current.page;
    if (normalized < 1) {
      normalized = 1;
    }
    if (totalPages > 0 && normalized > totalPages) {
      normalized = totalPages;
    }
    if (normalized === current.page) {
      return;
    }

    this.pagination.update((state) => ({
      ...state,
      page: normalized
    }));
    await this.refreshListingData();
  }

  private async changePageSize(pageSize: number): Promise<void> {
    if (!Number.isFinite(pageSize) || pageSize < 1) {
      return;
    }

    const current = this.pagination();
    const normalized = Math.floor(pageSize);
    if (current.pageSize === normalized) {
      return;
    }

    this.pagination.set({
      ...current,
      page: 1,
      pageSize: normalized
    });
    await this.listingDataCoordinatorService.saveLanguagePreference(
      this.http,
      this.authenticatedUser() !== null,
      this.filters(),
      this.sortCriteria(),
      normalized,
      this.selectedLanguage()
    );
    await this.refreshListingData();
  }

  private async runDatabaseMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<void> {
    await this.listingDataCoordinatorService.runMaintenanceOperation({
      operation,
      http: this.http,
      setMaintenanceRunning: (running) => this.maintenanceRunning.set(running),
      setMaintenanceResultText: (text) => this.maintenanceResultText.set(text)
    });
  }

  private resetGuestState(): void {
    this.users.set([]);
    this.filters.set(createDefaultListingFilters());
    this.pagination.set(createDefaultListingPaginationState());
    this.persistFilteredTotalElementsInSession(0);
    this.sortCriteria.set([]);
    this.propertyLabels.set([]);
  }

  private readFilteredTotalElementsFromSession(): number {
    const raw = sessionStorage.getItem(AppComponent.FILTERED_TOTAL_ELEMENTS_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  }

  private persistFilteredTotalElementsInSession(totalElements: number): void {
    const normalized = Number.isFinite(totalElements) && totalElements >= 0
      ? Math.floor(totalElements)
      : 0;
    this.filteredTotalElements.set(normalized);
    sessionStorage.setItem(AppComponent.FILTERED_TOTAL_ELEMENTS_KEY, String(normalized));
  }

  private resolveRequestPageSize(currentPageSize: number): number {
    if (!Number.isFinite(currentPageSize) || currentPageSize <= 0) {
      return DASHBOARD_PAGE_SIZE_OPTIONS[0];
    }

    return Math.floor(currentPageSize);
  }
}
