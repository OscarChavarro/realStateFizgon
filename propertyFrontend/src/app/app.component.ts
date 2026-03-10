import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthSessionApiService } from 'src/app/dashboard/auth/auth-session-api.service';
import { AuthUserListItem } from 'src/app/dashboard/auth/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { AuthUsersService } from 'src/app/dashboard/auth/auth-users.service';
import { DashboardUsersPanelComponent } from 'src/app/dashboard/auth/components/dashboard-users-panel.component';
import { DashboardDataService } from 'src/app/dashboard/dashboard-data.service';
import { DashboardMaintenancePanelComponent } from 'src/app/dashboard/components/dashboard-maintenance-panel.component';
import { DashboardPropertiesTableComponent } from 'src/app/dashboard/components/dashboard-properties-table.component';
import { DashboardTopBarComponent } from 'src/app/dashboard/components/dashboard-top-bar.component';
import {
  DashboardFiltersState,
  createDefaultDashboardFilters
} from 'src/app/dashboard/filters/dashboard-filters.model';
import { DashboardUserPreferencesService } from 'src/app/dashboard/filters/dashboard-user-preferences.service';
import {
  PropertyLabelEntry,
  PropertyReviewLabel,
  DashboardPropertyRow,
  DashboardTab,
  SortCriterion,
  SortToggleRequest
} from 'src/app/dashboard/dashboard.types';
import { BrowserFullscreenService } from 'src/app/dashboard/services/browser-fullscreen.service';
import { MaintenanceOperationRunnerService } from 'src/app/dashboard/services/maintenance-operation-runner.service';
import { PropertySelectionService } from 'src/app/dashboard/services/property-selection.service';
import { SortCriteriaService } from 'src/app/dashboard/services/sort-criteria.service';
import { WorkspaceLayoutService } from 'src/app/dashboard/services/workspace-layout.service';
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
  private readonly dashboardDataService = inject(DashboardDataService);
  private readonly authSessionApiService = inject(AuthSessionApiService);
  private readonly authUsersService = inject(AuthUsersService);
  private readonly dashboardUserPreferencesService = inject(DashboardUserPreferencesService);
  private readonly workspaceLayoutService = inject(WorkspaceLayoutService);
  private readonly propertySelectionService = inject(PropertySelectionService);
  private readonly sortCriteriaService = inject(SortCriteriaService);
  private readonly maintenanceOperationRunnerService = inject(MaintenanceOperationRunnerService);
  private readonly browserFullscreenService = inject(BrowserFullscreenService);

  private socket: Socket | null = null;
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
  readonly leftPanelWidthPercent = this.workspaceLayoutService.leftPanelWidthPercent;
  readonly leftPanelHidden = this.workspaceLayoutService.leftPanelHidden;
  readonly rightPanelHidden = this.workspaceLayoutService.rightPanelHidden;

  async ngOnInit(): Promise<void> {
    this.loadSelectedLanguageFromSession();
    await this.loadBackendConfiguration();
    await this.loadGoogleLoginAvailability();
    await this.loadCurrentUser();
    await this.refreshDashboardData();
    this.connectUpdatesSocket();
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
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
    sessionStorage.setItem(AppComponent.SELECTED_LANGUAGE_KEY, language);
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
    this.workspaceLayoutService.startResize(event);
  }

  cycleWorkspaceLayout(): void {
    this.workspaceLayoutService.cycleLayout();
  }

  getWorkspaceColumns(): string {
    return this.workspaceLayoutService.getWorkspaceColumns();
  }

  getWorkspaceCycleIcon(): string {
    return this.workspaceLayoutService.getCycleIcon();
  }

  onMaintenanceOperationRequested(operation: DatabaseMaintenanceOperation): void {
    void this.runDatabaseMaintenanceOperation(operation);
  }

  getStaticMediaBaseUrl(): string {
    return this.staticMediaBaseUrl;
  }

  onFullscreenRequested(): void {
    void this.browserFullscreenService.toggleFullscreen();
  }

  onGoogleLoginRequested(): void {
    const loginUrl = this.authSessionApiService.buildGoogleLoginUrl(this.backendBaseUrl, window.location.href);
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
    this.workspaceLayoutService.updateResizeFromMouse(
      event,
      this.workspaceContainer?.nativeElement ?? null
    );
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.workspaceLayoutService.stopResize();
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.repeat || event.defaultPrevented) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (this.isTypingTarget(target)) {
      return;
    }

    if (event.key === 'ArrowUp') {
      if (this.activeTab() !== 'DASHBOARD') {
        return;
      }
      event.preventDefault();
      const selected = this.propertySelectionService.selectByKeyboard(this.properties(), -1);
      this.scrollSelectedPropertyRow(selected);
      return;
    }

    if (event.key === 'ArrowDown') {
      if (this.activeTab() !== 'DASHBOARD') {
        return;
      }
      event.preventDefault();
      const selected = this.propertySelectionService.selectByKeyboard(this.properties(), 1);
      this.scrollSelectedPropertyRow(selected);
      return;
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      void this.browserFullscreenService.toggleFullscreen();
      return;
    }

    if (event.code === 'Space' || event.key === ' ') {
      if (this.activeTab() !== 'DASHBOARD' || !this.authenticatedUser()) {
        return;
      }

      const visibleProperty = this.selectedProperty();
      if (!visibleProperty) {
        return;
      }

      event.preventDefault();
      void this.togglePropertyReview(visibleProperty);
    }
  }

  private connectUpdatesSocket(): void {
    this.socket = io(this.backendBaseUrl);
    this.socket.on('properties-count-updated', async () => {
      await this.refreshDashboardData();
    });
  }

  private async loadBackendConfiguration(): Promise<void> {
    const config = await this.dashboardDataService.loadBackendConfiguration(this.http);
    this.backendBaseUrl = config.backendBaseUrl;
    this.staticMediaBaseUrl = config.staticMediaBaseUrl;
    this.warnIfAuthHostMismatch();
  }

  private async loadGoogleLoginAvailability(): Promise<void> {
    const enabled = await this.authSessionApiService.loadGoogleLoginAvailability(this.http, this.backendBaseUrl);
    this.googleLoginEnabled.set(enabled);
  }

  private warnIfAuthHostMismatch(): void {
    try {
      const backendHost = new URL(this.backendBaseUrl).hostname;
      const frontendHost = window.location.hostname;
      if (backendHost !== frontendHost) {
        console.warn(
          `Auth host mismatch detected (frontend=${frontendHost}, backend=${backendHost}). ` +
          'Prefer the same hostname in frontend URL, backend.baseUrl and auth.google.redirectUri.'
        );
      }
    } catch {
      // Ignore URL parsing issues; normal request errors will surface elsewhere.
    }
  }

  private async loadCurrentUser(): Promise<void> {
    const user = await this.authSessionApiService.loadCurrentUser(this.http, this.backendBaseUrl);
    this.authenticatedUser.set(user);

    if (user) {
      await this.loadUserPreferences();
      if (this.activeTab() === 'DATABASE_MAINTENANCE_TAB' && !this.canMaintainDatabase()) {
        this.activeTab.set('DASHBOARD');
      }
      if (this.activeTab() === 'USERS_TAB' && this.canEditUsers()) {
        await this.loadUsers();
      }
      return;
    }

    this.users.set([]);
    this.filters.set(createDefaultDashboardFilters());
    this.propertyLabels.set([]);
    if (this.activeTab() === 'USERS_TAB' || this.activeTab() === 'DATABASE_MAINTENANCE_TAB') {
      this.activeTab.set('DASHBOARD');
    }
  }

  private async logoutCurrentUser(): Promise<void> {
    await this.authSessionApiService.logout(this.http, this.backendBaseUrl);
    this.authenticatedUser.set(null);
    this.users.set([]);
    this.filters.set(createDefaultDashboardFilters());
    this.propertyLabels.set([]);
    if (this.activeTab() === 'USERS_TAB' || this.activeTab() === 'DATABASE_MAINTENANCE_TAB') {
      this.activeTab.set('DASHBOARD');
    }
    await this.refreshDashboardData();
  }

  private async loadUsers(): Promise<void> {
    if (!this.canEditUsers()) {
      this.users.set([]);
      return;
    }

    this.usersLoading.set(true);
    const users = await this.authUsersService.loadUsers(this.http, this.backendBaseUrl);
    this.users.set(users);
    this.usersLoading.set(false);
  }

  private async deleteUserAndRefresh(userId: string): Promise<void> {
    if (!this.canEditUsers() || !userId) {
      return;
    }

    const currentUser = this.authenticatedUser();
    if (currentUser && currentUser.id === userId) {
      return;
    }

    this.usersLoading.set(true);
    const deleted = await this.authUsersService.deleteUser(this.http, this.backendBaseUrl, userId);
    if (deleted) {
      await this.loadUsers();
    } else {
      this.usersLoading.set(false);
    }
  }

  private async refreshDashboardData(): Promise<void> {
    this.loading.set(true);
    const dashboardData = await this.dashboardDataService.loadDashboardData(
      this.http,
      this.backendBaseUrl,
      this.sortCriteria(),
      this.filters().showClosed
    );

    this.count.set(dashboardData.count);
    this.allProperties.set(dashboardData.properties);
    this.propertySelectionService.syncAfterRefresh(this.properties());
    this.loading.set(false);
  }

  private async handleFiltersChange(filters: DashboardFiltersState): Promise<void> {
    const current = this.filters();
    this.filters.set(filters);
    if (current.showClosed === filters.showClosed) {
      return;
    }

    if (this.authenticatedUser()) {
      try {
        await this.dashboardUserPreferencesService.saveFilters(this.http, this.backendBaseUrl, filters);
      } catch {
        // Ignore persistence errors so filtering still updates UI from backend.
      }
    }

    await this.refreshDashboardData();
  }

  private async loadUserPreferences(): Promise<void> {
    const preferences = await this.dashboardUserPreferencesService.loadPreferences(this.http, this.backendBaseUrl);
    if (!preferences) {
      this.filters.set(createDefaultDashboardFilters());
      this.propertyLabels.set([]);
      return;
    }

    this.filters.set(preferences.filters);
    this.propertyLabels.set(preferences.propertyLabels);
  }

  private async togglePropertyReview(property: DashboardPropertyRow): Promise<void> {
    if (!this.authenticatedUser()) {
      return;
    }

    const currentReview = this.getPropertyReviewLabel(property.propertyId);
    const nextReview = this.nextReviewLabel(currentReview);
    try {
      const updatedLabels = await this.dashboardUserPreferencesService.setPropertyReview(
        this.http,
        this.backendBaseUrl,
        property.propertyId,
        nextReview
      );
      this.propertyLabels.set(updatedLabels);
    } catch {
      // Ignore API errors; UI state remains unchanged.
    }
  }

  private getPropertyReviewLabel(propertyId: string): PropertyReviewLabel {
    const entry = this.propertyLabels().find((item) => item.propertyId === propertyId);
    const review = entry?.labels.review;
    if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
      return review;
    }
    return 'NEW';
  }

  private getPropertyComment(propertyId: string): string {
    const entry = this.propertyLabels().find((item) => item.propertyId === propertyId);
    const comment = entry?.labels.comment;
    if (typeof comment === 'string') {
      return comment;
    }
    return '';
  }

  private async savePropertyComment(property: DashboardPropertyRow, commentRaw: string): Promise<void> {
    if (!this.authenticatedUser()) {
      return;
    }

    const comment = commentRaw.trim();
    if (this.getPropertyComment(property.propertyId) === comment) {
      return;
    }

    try {
      const updatedLabels = await this.dashboardUserPreferencesService.setPropertyComment(
        this.http,
        this.backendBaseUrl,
        property.propertyId,
        comment
      );
      this.propertyLabels.set(updatedLabels);
    } catch {
      // Ignore API errors; UI state remains unchanged.
    }
  }

  private nextReviewLabel(current: PropertyReviewLabel): PropertyReviewLabel {
    if (current === 'NEW') {
      return 'FAVOURITE';
    }
    if (current === 'FAVOURITE') {
      return 'DISCHARGED';
    }
    return 'NEW';
  }

  private async toggleSort(sortBy: SortToggleRequest['sortBy'], sortOrder: SortToggleRequest['sortOrder']): Promise<void> {
    const updated = this.sortCriteriaService.toggleSortCriteria(
      this.sortCriteria(),
      sortBy,
      sortOrder
    );
    this.sortCriteria.set(updated);
    await this.refreshDashboardData();
  }

  private async runDatabaseMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<void> {
    this.maintenanceRunning.set(true);
    this.maintenanceResultText.set('');

    const resultText = await this.maintenanceOperationRunnerService.runOperation(
      operation,
      this.http,
      this.backendBaseUrl
    );
    this.maintenanceResultText.set(resultText);
    this.maintenanceRunning.set(false);
  }

  private loadSelectedLanguageFromSession(): void {
    const savedLanguage = sessionStorage.getItem(AppComponent.SELECTED_LANGUAGE_KEY);
    if (savedLanguage === 'sp' || savedLanguage === 'en') {
      this.selectedLanguage.set(savedLanguage);
      return;
    }

    this.selectedLanguage.set('en');
    sessionStorage.setItem(AppComponent.SELECTED_LANGUAGE_KEY, 'en');
  }

  private isTypingTarget(target: HTMLElement | null): boolean {
    if (!target) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input'
      || tagName === 'textarea'
      || tagName === 'select'
      || target.isContentEditable;
  }

  private scrollSelectedPropertyRow(property: DashboardPropertyRow | null): void {
    if (!property) {
      return;
    }

    queueMicrotask(() => {
      this.dashboardPropertiesTable?.scrollPropertyIntoView(property);
    });
  }
}
