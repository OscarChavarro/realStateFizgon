import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { DatabaseMaintenanceOperation } from 'src/app/databasemaintenance/database-maintenance-operation';
import { RemoveDanglingImagesOperation } from 'src/app/databasemaintenance/remove-dangling-images.operation';
import { I18nService, SupportedLanguage } from 'src/app/i18n/i18n.service';
import { PropertyDetailPanelComponent, PropertyDetailViewModel } from 'src/app/propertydetail/property-detail-panel.component';

type PropertiesCountResponse = {
  count: number;
};

type FrontendSecrets = {
  staticMedia?: string;
  backend?: {
    baseUrl?: string;
  };
};

type PropertiesResponse = {
  error: string | null;
  data: Array<{
    createdAt?: string | Date;
    propertyId?: string | number;
    createdBy?: string;
    importedBy?: string;
    title?: string;
    location?: string;
    description?: string;
    advertiserComment?: string;
    url?: string;
    price?: number | string | null;
    images?: Array<string | {
      url?: string;
      localUrl?: string | null;
      title?: string | null;
    }>;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalElements: number;
  };
};

type DashboardPropertyRow = {
  propertyId: string;
  createdAt: string;
  title: string;
  url: string;
  price: string;
  location: string;
  advertiserComment: string;
  localImageUrls: string[];
};

type SortDirection = 'asc' | 'desc';
type SortField = 'importedBy' | 'title' | 'price';
type SortCriterion = {
  sortBy: SortField;
  sortOrder: SortDirection;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PropertyDetailPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';
  private static readonly DEFAULT_BACKEND_BASE_URL = 'http://192.168.1.110:4200';
  private static readonly WORKSPACE_SPLITTER_WIDTH_PX = 16;
  private readonly http = inject(HttpClient);
  private readonly i18nService = inject(I18nService);
  private socket: Socket | null = null;
  private backendBaseUrl = AppComponent.DEFAULT_BACKEND_BASE_URL;
  private staticMediaBaseUrl = 'http://localhost:666/';
  private isResizingWorkspace = false;
  private lastTopBarTouchPointerUpAtMs = 0;
  @ViewChild('workspaceContainer') workspaceContainer?: ElementRef<HTMLDivElement>;

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly properties = signal<DashboardPropertyRow[]>([]);
  readonly selectedProperty = signal<PropertyDetailViewModel | null>(null);
  readonly lockedSelectedPropertyKey = signal<string | null>(null);
  readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly activeTab = signal<'DASHBOARD' | 'DATABASE_MAINTENANCE_TAB'>('DASHBOARD');
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
    await this.refreshDashboardData();
    this.connectUpdatesSocket();
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private connectUpdatesSocket(): void {
    this.socket = io(this.backendBaseUrl);
    this.socket.on('properties-count-updated', async () => {
      await this.refreshDashboardData();
    });
  }

  private async refreshDashboardData(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<PropertiesResponse>(this.buildPropertiesEndpointUrl())
      );

      this.count.set(response.pagination.totalElements ?? response.data.length);
      this.properties.set(this.mapPropertiesForDashboard(response.data));
    } catch {
      const countResponse = await firstValueFrom(
        this.http.get<PropertiesCountResponse>(`${this.backendBaseUrl}/properties/count`)
      );
      this.count.set(countResponse.count);
      this.properties.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  selectTab(tabId: 'DASHBOARD' | 'DATABASE_MAINTENANCE_TAB'): void {
    this.activeTab.set(tabId);
  }

  onLanguageChange(language: string): void {
    const selectedLanguage: SupportedLanguage = language === 'sp' ? 'sp' : 'en';
    this.selectedLanguage.set(selectedLanguage);
    sessionStorage.setItem(AppComponent.SELECTED_LANGUAGE_KEY, selectedLanguage);
  }

  t(id: string): string {
    return this.i18nService.get(id, this.selectedLanguage());
  }

  async toggleSort(sortBy: SortField, sortOrder: SortDirection): Promise<void> {
    const updated = [...this.sortCriteria()];
    const existingIndex = updated.findIndex((criterion) => criterion.sortBy === sortBy);

    if (existingIndex < 0) {
      updated.push({ sortBy, sortOrder });
    } else {
      const existing = updated[existingIndex];
      if (existing.sortOrder === sortOrder) {
        updated.splice(existingIndex, 1);
      } else {
        updated[existingIndex] = {
          sortBy,
          sortOrder
        };
      }
    }

    this.sortCriteria.set(updated);
    this.loading.set(true);
    await this.refreshDashboardData();
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

  isPropertyRowLocked(property: DashboardPropertyRow): boolean {
    return this.lockedSelectedPropertyKey() === this.getPropertyRowKey(property);
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

    // split -> only left -> only right -> split
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

  getSortDirection(sortBy: SortField): SortDirection | null {
    const criterion = this.sortCriteria().find((item) => item.sortBy === sortBy);
    return criterion?.sortOrder ?? null;
  }

  getSortPriority(sortBy: SortField): number | null {
    const index = this.sortCriteria().findIndex((item) => item.sortBy === sortBy);
    if (index < 0) {
      return null;
    }
    return index + 1;
  }

  shouldShowSortPriority(sortBy: SortField): boolean {
    return this.sortCriteria().length > 1 && this.getSortPriority(sortBy) !== null;
  }

  async runDatabaseMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<void> {
    this.maintenanceRunning.set(true);
      this.maintenanceResultText.set('');

    try {
      const result = await operation.execute(this.http, this.backendBaseUrl);
      const resultPayload = {
        status: result.status,
        body: result.body
      };
      this.maintenanceResultText.set(JSON.stringify(resultPayload, null, 2));
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

  private async loadBackendConfiguration(): Promise<void> {
    try {
      const secrets = await firstValueFrom(
        this.http.get<FrontendSecrets>('/secrets.json')
      );
      const configuredBaseUrl = secrets.backend?.baseUrl?.trim();
      if (configuredBaseUrl) {
        this.backendBaseUrl = configuredBaseUrl.endsWith('/')
          ? configuredBaseUrl.slice(0, -1)
          : configuredBaseUrl;
      }

      const configuredStaticMedia = secrets.staticMedia?.trim();
      if (configuredStaticMedia) {
        this.staticMediaBaseUrl = configuredStaticMedia.endsWith('/')
          ? configuredStaticMedia
          : `${configuredStaticMedia}/`;
      }
    } catch {
      this.backendBaseUrl = AppComponent.DEFAULT_BACKEND_BASE_URL;
    }
  }

  getStaticMediaBaseUrl(): string {
    return this.staticMediaBaseUrl;
  }

  private mapPropertiesForDashboard(rawRows: PropertiesResponse['data']): DashboardPropertyRow[] {
    const mappedRows = rawRows.map((row) => {
      const createdAt = this.toDateOnlyString(
        row.createdAt
        ?? row.createdBy
        ?? row.importedBy
      );
      const propertyId = row.propertyId === undefined || row.propertyId === null
        ? ''
        : String(row.propertyId);

      const title = typeof row.title === 'string' && row.title.trim().length > 0
        ? row.title.trim()
        : '-';
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      const location = typeof row.location === 'string' && row.location.trim().length > 0
        ? row.location.trim()
        : '';
      const advertiserComment = typeof row.advertiserComment === 'string' && row.advertiserComment.trim().length > 0
        ? row.advertiserComment.trim()
        : (typeof row.description === 'string' ? row.description.trim() : '');
      const price = row.price === null || row.price === undefined
        ? '-'
        : String(row.price);
      const localImageUrls = this.extractLocalImageUrls(row.images);

      return {
        propertyId,
        createdAt,
        title,
        url,
        price,
        location,
        advertiserComment,
        localImageUrls
      };
    });

    const lockedKey = this.lockedSelectedPropertyKey();
    if (lockedKey) {
      const lockedRow = mappedRows.find((row) => this.getPropertyRowKey(row) === lockedKey);
      if (lockedRow) {
        this.selectedProperty.set(lockedRow);
      } else {
        this.lockedSelectedPropertyKey.set(null);
      }
    }

    if (mappedRows.length > 0 && !this.selectedProperty()) {
      this.selectedProperty.set(mappedRows[0]);
    }

    return mappedRows;
  }

  private toDateOnlyString(value: unknown): string {
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) {
        return '';
      }

      const isoDatePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoDatePrefix) {
        return isoDatePrefix[1];
      }

      const parsedFromString = new Date(raw);
      if (!Number.isNaN(parsedFromString.getTime())) {
        return this.formatLocalDate(parsedFromString);
      }

      return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return this.formatLocalDate(value);
    }

    return '';
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildPropertiesEndpointUrl(): string {
    const url = new URL(`${this.backendBaseUrl}/properties`);
    for (const criterion of this.sortCriteria()) {
      url.searchParams.append('sortOrder', criterion.sortOrder);
      url.searchParams.append('sortBy', criterion.sortBy);
    }

    return url.toString();
  }

  private getPropertyRowKey(property: DashboardPropertyRow): string {
    return `${property.propertyId}|${property.url}|${property.createdAt}|${property.title}`;
  }

  private extractLocalImageUrls(images: PropertiesResponse['data'][number]['images']): string[] {
    if (!Array.isArray(images)) {
      return [];
    }

    const localUrls: string[] = [];
    for (const imageItem of images) {
      if (typeof imageItem === 'object' && imageItem !== null) {
        const localUrl = typeof imageItem.localUrl === 'string' ? imageItem.localUrl.trim() : '';
        if (localUrl.length > 0) {
          localUrls.push(localUrl);
        }
      }
    }

    return localUrls;
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

  onTopBarDoubleClick(): void {
    void this.toggleFullscreen();
  }

  onTopBarPointerUp(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      return;
    }

    const now = Date.now();
    const delta = now - this.lastTopBarTouchPointerUpAtMs;
    this.lastTopBarTouchPointerUpAtMs = now;

    if (delta <= 350) {
      this.lastTopBarTouchPointerUpAtMs = 0;
      void this.toggleFullscreen();
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.isResizingWorkspace = false;
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
      currentIndex = rows.findIndex((row) => this.getPropertyRowKey(row) === this.getPropertyRowKey(selected));
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

  getWorkspaceCycleIcon(): string {
    if (!this.leftPanelHidden() && !this.rightPanelHidden()) {
      return 'vertical_split';
    }
    if (!this.leftPanelHidden() && this.rightPanelHidden()) {
      return 'left_panel_open';
    }
    return 'right_panel_open';
  }
}
