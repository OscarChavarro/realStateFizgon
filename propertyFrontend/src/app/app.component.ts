import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { firstValueFrom } from 'rxjs';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { DashboardDataService } from 'src/app/dashboard/dashboard-data.service';
import { DashboardMaintenancePanelComponent } from 'src/app/dashboard/components/dashboard-maintenance-panel.component';
import { DashboardPropertiesTableComponent } from 'src/app/dashboard/components/dashboard-properties-table.component';
import { DashboardTopBarComponent } from 'src/app/dashboard/components/dashboard-top-bar.component';
import { applyDashboardFilters } from 'src/app/dashboard/filters/dashboard-filters.engine';
import {
  DashboardFiltersState,
  createDefaultDashboardFilters
} from 'src/app/dashboard/filters/dashboard-filters.model';
import {
  DashboardPropertyRow,
  DashboardTab,
  SortCriterion,
  SortDirection,
  SortField,
  SortToggleRequest
} from 'src/app/dashboard/dashboard.types';
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
    PropertyDetailPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';
  private static readonly WORKSPACE_SPLITTER_WIDTH_PX = 8;

  private readonly http = inject(HttpClient);
  private readonly dashboardDataService = inject(DashboardDataService);

  private socket: Socket | null = null;
  private backendBaseUrl = DashboardDataService.DEFAULT_BACKEND_BASE_URL;
  private staticMediaBaseUrl = DashboardDataService.DEFAULT_STATIC_MEDIA_BASE_URL;
  private isResizingWorkspace = false;

  @ViewChild('workspaceContainer') workspaceContainer?: ElementRef<HTMLDivElement>;

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly allProperties = signal<DashboardPropertyRow[]>([]);
  readonly filters = signal<DashboardFiltersState>(createDefaultDashboardFilters());
  readonly properties = computed<DashboardPropertyRow[]>(() =>
    applyDashboardFilters(this.allProperties(), this.filters())
  );
  readonly visibleCount = computed<number>(() => this.properties().length);
  readonly selectedProperty = signal<DashboardPropertyRow | null>(null);
  readonly lockedSelectedPropertyKey = signal<string | null>(null);
  readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly activeTab = signal<DashboardTab>('DASHBOARD');
  readonly googleLoginEnabled = signal<boolean>(true);
  readonly authenticatedUser = signal<AuthenticatedUser | null>(null);
  readonly authenticatedUserAvatarUrl = computed<string | null>(() => {
    if (!this.authenticatedUser()) {
      return null;
    }
    return `${this.backendBaseUrl}/auth/google/avatar`;
  });
  readonly maintenanceOperations: DatabaseMaintenanceOperation[] = [
    new RemoveDanglingImagesOperation()
  ];
  readonly maintenanceRunning = signal<boolean>(false);
  readonly maintenanceResultText = signal<string>('');
  readonly sortCriteria = signal<SortCriterion[]>([]);
  readonly leftPanelWidthPercent = signal<number>(50);
  readonly leftPanelHidden = signal<boolean>(false);
  readonly rightPanelHidden = signal<boolean>(false);

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
    this.activeTab.set(tabId);
  }

  onLanguageChange(language: SupportedLanguage): void {
    this.selectedLanguage.set(language);
    sessionStorage.setItem(AppComponent.SELECTED_LANGUAGE_KEY, language);
  }

  onFiltersChange(filters: DashboardFiltersState): void {
    this.filters.set(filters);
    this.syncSelectedPropertyAfterRefresh(this.properties());
  }

  onSortToggle(request: SortToggleRequest): void {
    void this.toggleSort(request.sortBy, request.sortOrder);
  }

  onPropertyRowHover(property: DashboardPropertyRow): void {
    if (this.lockedSelectedPropertyKey()) {
      return;
    }

    this.selectedProperty.set(property);
  }

  onPropertyRowClick(property: DashboardPropertyRow): void {
    const rowKey = this.getPropertyRowKey(property);
    const currentLockedKey = this.lockedSelectedPropertyKey();

    if (currentLockedKey === rowKey) {
      this.lockedSelectedPropertyKey.set(null);
      return;
    }

    this.lockedSelectedPropertyKey.set(rowKey);
    this.selectedProperty.set(property);
  }

  onSplitterMouseDown(event: MouseEvent): void {
    if (this.leftPanelHidden() || this.rightPanelHidden()) {
      return;
    }

    this.isResizingWorkspace = true;
    event.preventDefault();
  }

  cycleWorkspaceLayout(): void {
    const leftHidden = this.leftPanelHidden();
    const rightHidden = this.rightPanelHidden();

    if (!leftHidden && !rightHidden) {
      this.rightPanelHidden.set(true);
      this.leftPanelHidden.set(false);
      return;
    }

    if (!leftHidden && rightHidden) {
      this.leftPanelHidden.set(true);
      this.rightPanelHidden.set(false);
      return;
    }

    this.leftPanelHidden.set(false);
    this.rightPanelHidden.set(false);
  }

  getWorkspaceColumns(): string {
    const splitterWidth = AppComponent.WORKSPACE_SPLITTER_WIDTH_PX;
    if (this.leftPanelHidden() && !this.rightPanelHidden()) {
      return `0 ${splitterWidth}px minmax(0, 1fr)`;
    }

    if (this.rightPanelHidden() && !this.leftPanelHidden()) {
      return `minmax(0, 1fr) ${splitterWidth}px 0`;
    }

    const left = this.leftPanelWidthPercent();
    const right = 100 - left;
    return `minmax(280px, ${left}%) ${splitterWidth}px minmax(280px, ${right}%)`;
  }

  getWorkspaceCycleIcon(): string {
    if (!this.leftPanelHidden() && !this.rightPanelHidden()) {
      return 'vertical_split';
    }

    if (!this.leftPanelHidden() && this.rightPanelHidden()) {
      return 'left_panel_open';
    }

    return 'right_panel_open';
  }

  onMaintenanceOperationRequested(operation: DatabaseMaintenanceOperation): void {
    void this.runDatabaseMaintenanceOperation(operation);
  }

  getStaticMediaBaseUrl(): string {
    return this.staticMediaBaseUrl;
  }

  onFullscreenRequested(): void {
    void this.toggleFullscreen();
  }

  onGoogleLoginRequested(): void {
    const loginUrl = new URL('/auth/google/login', `${this.backendBaseUrl}/`);
    loginUrl.searchParams.set('returnTo', window.location.href);
    window.location.assign(loginUrl.toString());
  }

  onLogoutRequested(): void {
    void this.logoutCurrentUser();
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    if (!this.isResizingWorkspace || !this.workspaceContainer) {
      return;
    }

    const rect = this.workspaceContainer.nativeElement.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const cursorX = event.clientX - rect.left;
    const rawPercent = (cursorX / rect.width) * 100;
    const clamped = Math.min(85, Math.max(15, rawPercent));
    this.leftPanelWidthPercent.set(clamped);
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.isResizingWorkspace = false;
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
      this.selectPropertyByKeyboard(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      if (this.activeTab() !== 'DASHBOARD') {
        return;
      }
      event.preventDefault();
      this.selectPropertyByKeyboard(1);
      return;
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      void this.toggleFullscreen();
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
    try {
      const response = await firstValueFrom(
        this.http.get<{ enabled?: boolean }>(`${this.backendBaseUrl}/auth/google/login-url`)
      );
      this.googleLoginEnabled.set(response.enabled === true);
    } catch {
      this.googleLoginEnabled.set(false);
    }
  }

  private warnIfAuthHostMismatch(): void {
    try {
      const backendHost = new URL(this.backendBaseUrl).hostname;
      const frontendHost = window.location.hostname;
      if (backendHost !== frontendHost) {
        // Cross-site hosts can prevent auth cookies from being sent back on /auth/google/me.
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
    try {
      const response = await firstValueFrom(
        this.http.get<{ authenticated?: boolean; user?: AuthenticatedUser | null }>(
          `${this.backendBaseUrl}/auth/google/me`,
          { withCredentials: true }
        )
      );

      if (response.authenticated && response.user) {
        this.authenticatedUser.set(response.user);
      } else {
        this.authenticatedUser.set(null);
      }
    } catch {
      this.authenticatedUser.set(null);
    }
  }

  private async logoutCurrentUser(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.backendBaseUrl}/auth/google/logout`,
          {},
          { withCredentials: true }
        )
      );
    } finally {
      this.authenticatedUser.set(null);
    }
  }

  private async refreshDashboardData(): Promise<void> {
    this.loading.set(true);
    const dashboardData = await this.dashboardDataService.loadDashboardData(
      this.http,
      this.backendBaseUrl,
      this.sortCriteria()
    );

    this.count.set(dashboardData.count);
    this.allProperties.set(dashboardData.properties);
    this.syncSelectedPropertyAfterRefresh(this.properties());
    this.loading.set(false);
  }

  private async toggleSort(sortBy: SortField, sortOrder: SortDirection): Promise<void> {
    const updated = [...this.sortCriteria()];
    const existingIndex = updated.findIndex((criterion) => criterion.sortBy === sortBy);

    if (existingIndex < 0) {
      updated.push({ sortBy, sortOrder });
    } else {
      const existing = updated[existingIndex];
      if (existing.sortOrder === sortOrder) {
        updated.splice(existingIndex, 1);
      } else {
        updated[existingIndex] = { sortBy, sortOrder };
      }
    }

    this.sortCriteria.set(updated);
    await this.refreshDashboardData();
  }

  private async runDatabaseMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<void> {
    this.maintenanceRunning.set(true);
    this.maintenanceResultText.set('');

    try {
      const result = await operation.execute(this.http, this.backendBaseUrl);
      this.maintenanceResultText.set(
        JSON.stringify(
          {
            status: result.status,
            body: result.body
          },
          null,
          2
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.maintenanceResultText.set(
        JSON.stringify(
          {
            status: 'request-failed',
            error: message
          },
          null,
          2
        )
      );
    } finally {
      this.maintenanceRunning.set(false);
    }
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

  private syncSelectedPropertyAfterRefresh(rows: DashboardPropertyRow[]): void {
    const lockedKey = this.lockedSelectedPropertyKey();
    if (lockedKey) {
      const lockedRow = rows.find((row) => this.getPropertyRowKey(row) === lockedKey);
      if (lockedRow) {
        this.selectedProperty.set(lockedRow);
      } else {
        this.lockedSelectedPropertyKey.set(null);
      }
      return;
    }

    const selected = this.selectedProperty();
    if (selected) {
      const selectedKey = this.getPropertyRowKey(selected);
      const matchingRow = rows.find((row) => this.getPropertyRowKey(row) === selectedKey);
      if (matchingRow) {
        this.selectedProperty.set(matchingRow);
        return;
      }
    }

    this.selectedProperty.set(rows.length > 0 ? rows[0] : null);
  }

  private getPropertyRowKey(property: DashboardPropertyRow): string {
    return `${property.propertyId}|${property.url}|${property.createdAt}|${property.title}`;
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

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const rootElement = document.documentElement;
    if (rootElement.requestFullscreen) {
      await rootElement.requestFullscreen();
    }
  }

  private selectPropertyByKeyboard(delta: -1 | 1): void {
    const rows = this.properties();
    if (rows.length === 0) {
      return;
    }

    const lockedKey = this.lockedSelectedPropertyKey();
    const selected = this.selectedProperty();
    let currentIndex = -1;

    if (lockedKey) {
      currentIndex = rows.findIndex((row) => this.getPropertyRowKey(row) === lockedKey);
    } else if (selected) {
      const selectedKey = this.getPropertyRowKey(selected);
      currentIndex = rows.findIndex((row) => this.getPropertyRowKey(row) === selectedKey);
    }

    if (currentIndex < 0) {
      currentIndex = 0;
    }

    const nextIndex = Math.min(rows.length - 1, Math.max(0, currentIndex + delta));
    const nextRow = rows[nextIndex];
    const nextKey = this.getPropertyRowKey(nextRow);

    this.selectedProperty.set(nextRow);
    this.lockedSelectedPropertyKey.set(nextKey);
  }
}
