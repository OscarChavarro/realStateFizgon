import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiRuntimeConfigService } from 'src/app/api/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/api/api-session-events.service';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { DashboardTab } from 'src/app/dashboard/dashboard.types';
import { DashboardAuthFacadeService } from 'src/app/dashboard/shell/services/dashboard-auth-facade.service';
import { DashboardSessionCoordinatorService } from 'src/app/dashboard/shell/services/dashboard-session-coordinator.service';
import { DashboardStateFacadeService } from 'src/app/dashboard/shell/services/dashboard-state-facade.service';
import { SupportedLanguage } from 'src/app/i18n/i18n.service';

type AuthBootstrapParams = {
  http: HttpClient;
  destroyRef: DestroyRef;
  frontendHost: string;
  selectedLanguageKey: string;
  setSelectedLanguage: (language: SupportedLanguage) => void;
  setBackendBaseUrl: (backendBaseUrl: string) => void;
  setStaticMediaBaseUrl: (staticMediaBaseUrl: string) => void;
  setGoogleLoginEnabled: (enabled: boolean) => void;
  activeTab: DashboardTab;
  canMaintainDatabase: () => boolean;
  canEditUsers: () => boolean;
  setAuthenticatedUser: (user: AuthenticatedUser | null) => void;
  setActiveTab: (tab: DashboardTab) => void;
  onLoadUserPreferences: () => Promise<void>;
  onLoadUsers: () => Promise<void>;
  onResetGuestState: () => void;
  isAuthenticated: () => boolean;
  getActiveTab: () => DashboardTab;
  onRefreshDashboardData: () => Promise<void>;
};

@Injectable({
  providedIn: 'root'
})
export class AuthBootstrapUseCaseService {
  constructor(
    private readonly dashboardStateFacadeService: DashboardStateFacadeService,
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService,
    private readonly dashboardAuthFacadeService: DashboardAuthFacadeService,
    private readonly dashboardSessionCoordinatorService: DashboardSessionCoordinatorService,
    private readonly apiSessionEventsService: ApiSessionEventsService
  ) {}

  async initialize(params: AuthBootstrapParams): Promise<void> {
    params.setSelectedLanguage(
      this.dashboardStateFacadeService.loadSelectedLanguageFromSession(params.selectedLanguageKey)
    );

    this.bindUnauthorizedSessionReset(params);

    const config = await this.dashboardStateFacadeService.loadBackendConfiguration(params.http);
    this.apiRuntimeConfigService.setConfiguration(config);
    params.setBackendBaseUrl(this.apiRuntimeConfigService.getBackendBaseUrl());
    params.setStaticMediaBaseUrl(this.apiRuntimeConfigService.getStaticMediaBaseUrl());
    this.dashboardAuthFacadeService.warnIfAuthHostMismatch(params.frontendHost);

    const googleLoginEnabled = await this.dashboardAuthFacadeService.loadGoogleLoginAvailability(params.http);
    params.setGoogleLoginEnabled(googleLoginEnabled);

    await this.dashboardSessionCoordinatorService.loadCurrentUserAndApplyState({
      http: params.http,
      activeTab: params.activeTab,
      canMaintainDatabase: params.canMaintainDatabase,
      canEditUsers: params.canEditUsers,
      setAuthenticatedUser: params.setAuthenticatedUser,
      setActiveTab: params.setActiveTab,
      onLoadUserPreferences: params.onLoadUserPreferences,
      onLoadUsers: params.onLoadUsers,
      onResetGuestState: params.onResetGuestState
    });
  }

  private bindUnauthorizedSessionReset(params: AuthBootstrapParams): void {
    this.apiSessionEventsService.unauthorized$
      .pipe(takeUntilDestroyed(params.destroyRef))
      .subscribe(() => {
        if (!params.isAuthenticated()) {
          return;
        }

        params.setAuthenticatedUser(null);
        params.onResetGuestState();
        if (params.getActiveTab() === 'USERS_TAB' || params.getActiveTab() === 'DATABASE_MAINTENANCE_TAB') {
          params.setActiveTab('DASHBOARD');
        }
        void params.onRefreshDashboardData();
      });
  }
}
