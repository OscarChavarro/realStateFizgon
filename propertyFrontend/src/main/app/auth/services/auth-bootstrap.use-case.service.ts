import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/core/api/services/api-session-events.service';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { ListingTab } from 'src/app/listing/model/listing.types';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';

type AuthBootstrapParams = {
  http: HttpClient;
  destroyRef: DestroyRef;
  frontendHost: string;
  selectedLanguageKey: string;
  setSelectedLanguage: (language: SupportedLanguage) => void;
  setBackendBaseUrl: (backendBaseUrl: string) => void;
  setStaticMediaBaseUrl: (staticMediaBaseUrl: string) => void;
  setGoogleMapsApiKey: (googleMapsApiKey: string | null) => void;
  setGoogleMapsMapId: (googleMapsMapId: string | null) => void;
  setGoogleLoginEnabled: (enabled: boolean) => void;
  activeTab: ListingTab;
  canMaintainDatabase: () => boolean;
  canEditUsers: () => boolean;
  setAuthenticatedUser: (user: AuthenticatedUser | null) => void;
  setActiveTab: (tab: ListingTab) => void;
  onLoadUserPreferences: () => Promise<void>;
  onLoadUsers: () => Promise<void>;
  onResetGuestState: () => void;
  isAuthenticated: () => boolean;
  getActiveTab: () => ListingTab;
  onRefreshListingData: () => Promise<void>;
};

@Injectable({
  providedIn: 'root'
})
export class AuthBootstrapUseCaseService {
  constructor(
    private readonly listingStateFacadeService: ListingStateFacadeService,
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService,
    private readonly listingAuthFacadeService: AuthFacadeService,
    private readonly listingSessionCoordinatorService: SessionCoordinatorService,
    private readonly apiSessionEventsService: ApiSessionEventsService
  ) {}

  async initialize(params: AuthBootstrapParams): Promise<void> {
    params.setSelectedLanguage(
      this.listingStateFacadeService.loadSelectedLanguageFromSession(params.selectedLanguageKey)
    );

    this.bindUnauthorizedSessionReset(params);

    const config = await this.listingStateFacadeService.loadBackendConfiguration(params.http);
    this.apiRuntimeConfigService.setConfiguration(config);
    params.setBackendBaseUrl(this.apiRuntimeConfigService.getBackendBaseUrl());
    params.setStaticMediaBaseUrl(this.apiRuntimeConfigService.getStaticMediaBaseUrl());
    params.setGoogleMapsApiKey(config.googleMapsApiKey);
    params.setGoogleMapsMapId(config.googleMapsMapId);
    this.listingAuthFacadeService.warnIfAuthHostMismatch(params.frontendHost);

    const googleLoginEnabled = await this.listingAuthFacadeService.loadGoogleLoginAvailability(params.http);
    params.setGoogleLoginEnabled(googleLoginEnabled);

    await this.listingSessionCoordinatorService.loadCurrentUserAndApplyState({
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
        void params.onRefreshListingData();
      });
  }
}
