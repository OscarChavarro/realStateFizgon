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

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private static readonly SELECTED_LANGUAGE_KEY = 'selectedLanguage';
  private readonly http = inject(HttpClient);
  private readonly i18nService = inject(I18nService);
  private socket: Socket | null = null;

  readonly count = signal<number>(0);
  readonly loading = signal<boolean>(true);
  readonly lastUpdatedAt = signal<string>('');
  readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly activeTab = signal<'DASHBOARD' | 'DATABASE_MAINTENANCE_TAB'>('DASHBOARD');
  readonly maintenanceOperations: DatabaseMaintenanceOperation[] = [
    new RemoveDanglingImagesOperation()
  ];
  readonly maintenanceRunning = signal<boolean>(false);
  readonly maintenanceResultText = signal<string>('');

  async ngOnInit(): Promise<void> {
    this.loadSelectedLanguageFromSession();
    await this.refreshCount();
    this.connectUpdatesSocket();
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private connectUpdatesSocket(): void {
    this.socket = io('http://localhost:8081');
    this.socket.on('properties-count-updated', async () => {
      await this.refreshCount();
    });
  }

  private async refreshCount(): Promise<void> {
    const response = await firstValueFrom(
      this.http.get<PropertiesCountResponse>('http://localhost:8081/properties/count')
    );

    this.count.set(response.count);
    this.lastUpdatedAt.set(new Date().toISOString());
    this.loading.set(false);
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

  async runDatabaseMaintenanceOperation(operation: DatabaseMaintenanceOperation): Promise<void> {
    this.maintenanceRunning.set(true);
    this.maintenanceResultText.set('');

    try {
      const result = await operation.execute(this.http);
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
}
