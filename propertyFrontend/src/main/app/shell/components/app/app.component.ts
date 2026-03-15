import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { UsersPanelComponent } from 'src/app/auth/components/users-panel/users-panel.component';
import { MaintenancePanelComponent } from 'src/app/maintenance/components/maintenance-panel/maintenance-panel.component';
import { ListingPropertiesTableComponent } from 'src/app/listing/components/listing-properties-table/listing-properties-table.component';
import { ListingMapTabComponent } from 'src/app/listing/components/listing-map-tab/listing-map-tab.component';
import { ListingTopBarComponent } from 'src/app/listing/components/listing-top-bar/listing-top-bar.component';
import { ListingFiltersState, createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import {
  ListingPropertyRow,
  ListingTab,
  SortToggleRequest
} from 'src/app/listing/model/listing.types';
import { createDefaultListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';
import { AuthBootstrapUseCaseService } from 'src/app/auth/services/auth-bootstrap.use-case.service';
import { ListingBootstrapUseCaseService } from 'src/app/listing/services/listing-bootstrap.use-case.service';
import { UserSessionManagementUseCaseService } from 'src/app/auth/services/user-session-management.use-case.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { ListingInteractionUseCaseService } from 'src/app/listing/services/listing-interaction.use-case.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { PropertyDetailPanelComponent } from 'src/app/property/components/property-detail-panel/property-detail-panel.component';
import { ShellInputInteractionUseCaseService } from 'src/app/shell/services/shell-input-interaction.use-case.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';
import { AppShellCommandsUseCaseService } from 'src/app/shell/services/app-shell-commands.use-case.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ListingTopBarComponent,
    ListingPropertiesTableComponent,
    ListingMapTabComponent,
    MaintenancePanelComponent,
    UsersPanelComponent,
    PropertyDetailPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';

  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listingAuthFacadeService = inject(AuthFacadeService);
  private readonly listingStateFacadeService = inject(ListingStateFacadeService);
  private readonly workspaceInteractionCoordinatorService = inject(WorkspaceInteractionCoordinatorService);
  private readonly authBootstrapUseCaseService = inject(AuthBootstrapUseCaseService);
  private readonly listingBootstrapUseCaseService = inject(ListingBootstrapUseCaseService);
  private readonly userSessionManagementUseCaseService = inject(UserSessionManagementUseCaseService);
  private readonly propertySelectionService = inject(PropertySelectionService);
  private readonly listingQueryOrchestratorService = inject(ListingQueryOrchestratorService);
  private readonly listingInteractionUseCaseService = inject(ListingInteractionUseCaseService);
  private readonly shellInputInteractionUseCaseService = inject(ShellInputInteractionUseCaseService);
  private readonly appShellStateService = inject(AppShellStateService);
  private readonly appShellCommandsUseCaseService = inject(AppShellCommandsUseCaseService);

  @ViewChild('workspaceContainer') workspaceContainer?: ElementRef<HTMLDivElement>;
  @ViewChild(ListingPropertiesTableComponent) listingPropertiesTable?: ListingPropertiesTableComponent;
  @ViewChild(PropertyDetailPanelComponent) propertyDetailPanel?: PropertyDetailPanelComponent;

  readonly count = this.appShellStateService.count;
  readonly loading = this.appShellStateService.loading;
  readonly allProperties = this.appShellStateService.allProperties;
  readonly filters = this.appShellStateService.filters;
  readonly pagination = this.appShellStateService.pagination;
  readonly properties = this.appShellStateService.properties;
  readonly filteredTotalElements = this.appShellStateService.filteredTotalElements;
  readonly visibleCount = this.appShellStateService.visibleCount;
  readonly selectedProperty = this.appShellStateService.selectedProperty;
  readonly lockedSelectedPropertyKey = this.appShellStateService.lockedSelectedPropertyKey;
  readonly selectedLanguage = this.appShellStateService.selectedLanguage;
  readonly activeTab = this.appShellStateService.activeTab;
  readonly googleLoginEnabled = this.appShellStateService.googleLoginEnabled;
  readonly authenticatedUser = this.appShellStateService.authenticatedUser;
  readonly canEditUsers = this.appShellStateService.canEditUsers;
  readonly canMaintainDatabase = this.appShellStateService.canMaintainDatabase;
  readonly authenticatedUserAvatarUrl = this.appShellStateService.authenticatedUserAvatarUrl;
  readonly users = this.appShellStateService.users;
  readonly usersLoading = this.appShellStateService.usersLoading;
  readonly propertyLabels = this.appShellStateService.propertyLabels;
  readonly maintenanceOperations = this.appShellStateService.maintenanceOperations;
  readonly maintenanceRunning = this.appShellStateService.maintenanceRunning;
  readonly maintenanceResultText = this.appShellStateService.maintenanceResultText;
  readonly sortCriteria = this.appShellStateService.sortCriteria;
  readonly leftPanelHidden = this.appShellStateService.leftPanelHidden;
  readonly rightPanelHidden = this.appShellStateService.rightPanelHidden;

  async ngOnInit(): Promise<void> {
    this.filteredTotalElements.set(this.listingQueryOrchestratorService.readFilteredTotalElementsFromSession());

    await this.authBootstrapUseCaseService.initialize({
      http: this.http,
      destroyRef: this.destroyRef,
      frontendHost: window.location.hostname,
      selectedLanguageKey: AppComponent.SELECTED_LANGUAGE_KEY,
      setSelectedLanguage: (language) => this.selectedLanguage.set(language),
      setBackendBaseUrl: (backendBaseUrl) => {
        this.appShellStateService.backendBaseUrl.set(backendBaseUrl);
      },
      setStaticMediaBaseUrl: (staticMediaBaseUrl) => {
        this.appShellStateService.staticMediaBaseUrl.set(staticMediaBaseUrl);
      },
      setGoogleMapsApiKey: (googleMapsApiKey) => {
        this.appShellStateService.googleMapsApiKey.set(googleMapsApiKey);
      },
      setGoogleMapsMapId: (googleMapsMapId) => {
        this.appShellStateService.googleMapsMapId.set(googleMapsMapId);
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
    this.appShellCommandsUseCaseService.onTabChange({
      tabId,
      canEditUsers: this.canEditUsers(),
      canMaintainDatabase: this.canMaintainDatabase(),
      setActiveTab: (tab) => this.activeTab.set(tab),
      onLoadUsers: () => this.loadUsersForManagement()
    });
  }

  onLanguageChange(language: SupportedLanguage): void {
    this.appShellCommandsUseCaseService.onLanguageChange({
      http: this.http,
      language,
      selectedLanguageKey: AppComponent.SELECTED_LANGUAGE_KEY,
      isAuthenticated: this.authenticatedUser() !== null,
      filters: this.filters(),
      sortCriteria: this.sortCriteria(),
      pageSize: this.pagination().pageSize,
      setSelectedLanguage: (nextLanguage) => this.selectedLanguage.set(nextLanguage)
    });
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
    this.shellInputInteractionUseCaseService.onSplitterMouseDown(event);
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
    this.appShellCommandsUseCaseService.onMaintenanceOperationRequested({
      operation,
      http: this.http,
      setMaintenanceRunning: (running) => this.maintenanceRunning.set(running),
      setMaintenanceResultText: (text) => this.maintenanceResultText.set(text)
    });
  }

  getStaticMediaBaseUrl(): string {
    return this.appShellStateService.staticMediaBaseUrl();
  }

  getGoogleMapsApiKey(): string | null {
    return this.appShellStateService.googleMapsApiKey();
  }

  getGoogleMapsMapId(): string | null {
    return this.appShellStateService.googleMapsMapId();
  }

  onFullscreenRequested(): void {
    this.workspaceInteractionCoordinatorService.toggleFullscreen();
  }

  onGoogleLoginRequested(): void {
    const loginUrl = this.listingAuthFacadeService.buildGoogleLoginUrl(window.location.href);
    window.location.assign(loginUrl);
  }

  onLogoutRequested(): void {
    this.appShellCommandsUseCaseService.onLogoutRequested({
      http: this.http,
      getActiveTab: () => this.activeTab(),
      setActiveTab: (tab) => this.activeTab.set(tab),
      setAuthenticatedUser: (user) => this.authenticatedUser.set(user),
      onResetGuestState: () => this.resetGuestState(),
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  onDeleteUserRequested(userId: string): void {
    this.appShellCommandsUseCaseService.onDeleteUserRequested({
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
    this.shellInputInteractionUseCaseService.onWindowMouseMove(event, this.workspaceContainer);
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.shellInputInteractionUseCaseService.onWindowMouseUp();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    this.shellInputInteractionUseCaseService.onWindowKeyDown({
      event,
      activeTab: this.activeTab(),
      isAuthenticated: this.authenticatedUser() !== null,
      properties: this.properties(),
      selectedProperty: this.selectedProperty(),
      onTogglePropertyReview: (property) => {
        void this.togglePropertyReview(property);
      },
      onTogglePropertyLocationDialog: () => {
        this.propertyDetailPanel?.toggleLocationDialog();
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
    await this.listingQueryOrchestratorService.refreshListingData({
      http: this.http,
      getSortCriteria: () => this.sortCriteria(),
      getFilters: () => this.filters(),
      getPagination: () => this.pagination(),
      setLoading: (loading) => this.loading.set(loading),
      setCount: (count) => this.count.set(count),
      setAllProperties: (properties) => this.allProperties.set(properties),
      setPagination: (pagination) => this.pagination.set(pagination),
      onAfterRefresh: () => this.propertySelectionService.syncAfterRefresh(this.properties()),
      setFilteredTotalElements: (totalElements) => this.filteredTotalElements.set(totalElements)
    });
  }

  private async handleFiltersChange(filters: ListingFiltersState): Promise<void> {
    await this.listingQueryOrchestratorService.handleFiltersChange({
      http: this.http,
      getCurrentFilters: () => this.filters(),
      nextFilters: filters,
      getSortCriteria: () => this.sortCriteria(),
      getPageSize: () => this.pagination().pageSize,
      getSelectedLanguage: () => this.selectedLanguage(),
      isAuthenticated: () => this.authenticatedUser() !== null,
      setFilters: (nextFilters) => this.filters.set(nextFilters),
      onResetToFirstPage: () => {
        this.pagination.update((current) => ({
          ...current,
          page: 1
        }));
      },
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  private async loadUserPreferences(): Promise<void> {
    await this.listingQueryOrchestratorService.loadUserPreferences({
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
      setPropertyLabels: (labels) => this.propertyLabels.set(labels),
      setFilteredTotalElements: (totalElements) => this.filteredTotalElements.set(totalElements)
    });
  }

  private async togglePropertyReview(property: ListingPropertyRow): Promise<void> {
    await this.listingInteractionUseCaseService.togglePropertyReview({
      http: this.http,
      propertyId: property.propertyId,
      isAuthenticated: this.authenticatedUser() !== null,
      getPropertyLabels: () => this.propertyLabels(),
      setPropertyLabels: (labels) => this.propertyLabels.set(labels)
    });
  }

  private async savePropertyComment(property: ListingPropertyRow, commentRaw: string): Promise<void> {
    await this.listingInteractionUseCaseService.savePropertyComment({
      http: this.http,
      propertyId: property.propertyId,
      commentRaw,
      isAuthenticated: this.authenticatedUser() !== null,
      getPropertyLabels: () => this.propertyLabels(),
      setPropertyLabels: (labels) => this.propertyLabels.set(labels)
    });
  }

  private async toggleSort(sortBy: SortToggleRequest['sortBy']): Promise<void> {
    await this.listingQueryOrchestratorService.toggleSort({
      http: this.http,
      sortBy,
      getSortCriteria: () => this.sortCriteria(),
      getFilters: () => this.filters(),
      getPageSize: () => this.pagination().pageSize,
      getSelectedLanguage: () => this.selectedLanguage(),
      isAuthenticated: () => this.authenticatedUser() !== null,
      setSortCriteria: (criteria) => this.sortCriteria.set(criteria),
      onResetToFirstPage: () => {
        this.pagination.update((current) => ({
          ...current,
          page: 1
        }));
      },
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  private async changePage(page: number): Promise<void> {
    await this.listingQueryOrchestratorService.changePage({
      page,
      getPagination: () => this.pagination(),
      setPage: (normalizedPage) => {
        this.pagination.update((state) => ({
          ...state,
          page: normalizedPage
        }));
      },
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  private async changePageSize(pageSize: number): Promise<void> {
    await this.listingQueryOrchestratorService.changePageSize({
      http: this.http,
      pageSize,
      getPagination: () => this.pagination(),
      setPagination: (pagination) => this.pagination.set(pagination),
      getFilters: () => this.filters(),
      getSortCriteria: () => this.sortCriteria(),
      getSelectedLanguage: () => this.selectedLanguage(),
      isAuthenticated: () => this.authenticatedUser() !== null,
      onRefreshListingData: () => this.refreshListingData()
    });
  }

  private resetGuestState(): void {
    this.users.set([]);
    this.filters.set(createDefaultListingFilters());
    this.pagination.set(createDefaultListingPaginationState());
    this.listingQueryOrchestratorService.persistFilteredTotalElementsInSession(
      0,
      (totalElements) => this.filteredTotalElements.set(totalElements)
    );
    this.sortCriteria.set([]);
    this.propertyLabels.set([]);
  }
}
