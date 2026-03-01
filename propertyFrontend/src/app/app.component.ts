import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { DatabaseMaintenanceOperation } from './databasemaintenance/database-maintenance-operation';
import { RemoveDanglingImagesOperation } from './databasemaintenance/remove-dangling-images.operation';
import { I18nService, SupportedLanguage } from './i18n/i18n.service';

type PropertiesCountResponse = {
  count: number;
};

type FrontendSecrets = {
  backend?: {
    baseUrl?: string;
  };
};

type PropertiesResponse = {
  error: string | null;
  data: Array<{
    createdBy?: string;
    importedBy?: string;
    title?: string;
    url?: string;
    price?: number | string | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalElements: number;
  };
};

type DashboardPropertyRow = {
  createdAt: string;
  title: string;
  url: string;
  price: string;
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
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';
  private static readonly DEFAULT_BACKEND_BASE_URL = 'http://192.168.1.110:4200';
  private readonly http = inject(HttpClient);
  private readonly i18nService = inject(I18nService);
  private socket: Socket | null = null;
  private backendBaseUrl = AppComponent.DEFAULT_BACKEND_BASE_URL;

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly lastUpdatedAt = signal<string>('');
  readonly properties = signal<DashboardPropertyRow[]>([]);
  readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly activeTab = signal<'DASHBOARD' | 'DATABASE_MAINTENANCE_TAB'>('DASHBOARD');
  readonly maintenanceOperations: DatabaseMaintenanceOperation[] = [
    new RemoveDanglingImagesOperation()
  ];
  readonly maintenanceRunning = signal<boolean>(false);
  readonly maintenanceResultText = signal<string>('');
  readonly sortCriteria = signal<SortCriterion[]>([]);

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
      this.lastUpdatedAt.set(new Date().toISOString());
    } catch {
      const countResponse = await firstValueFrom(
        this.http.get<PropertiesCountResponse>(`${this.backendBaseUrl}/properties/count`)
      );
      this.count.set(countResponse.count);
      this.properties.set([]);
      this.lastUpdatedAt.set(new Date().toISOString());
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
    } catch {
      this.backendBaseUrl = AppComponent.DEFAULT_BACKEND_BASE_URL;
    }
  }

  private mapPropertiesForDashboard(rawRows: PropertiesResponse['data']): DashboardPropertyRow[] {
    return rawRows.map((row) => {
      const createdAtRaw = typeof row.createdBy === 'string' && row.createdBy.length > 0
        ? row.createdBy
        : (typeof row.importedBy === 'string' ? row.importedBy : '');
      const createdAtDate = createdAtRaw ? new Date(createdAtRaw) : null;
      const createdAt = createdAtDate && !Number.isNaN(createdAtDate.getTime())
        ? createdAtDate.toISOString()
        : '';

      const title = typeof row.title === 'string' && row.title.trim().length > 0
        ? row.title.trim()
        : '-';
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      const price = row.price === null || row.price === undefined
        ? '-'
        : String(row.price);

      return {
        createdAt,
        title,
        url,
        price
      };
    });
  }

  private buildPropertiesEndpointUrl(): string {
    const url = new URL(`${this.backendBaseUrl}/properties`);
    for (const criterion of this.sortCriteria()) {
      url.searchParams.append('sortOrder', criterion.sortOrder);
      url.searchParams.append('sortBy', criterion.sortBy);
    }

    return url.toString();
  }
}
