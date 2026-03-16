import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { ApiSessionEventsService } from 'src/app/core/api/services/api-session-events.service';
import { AuthFacadeService } from 'src/app/auth/services/auth-facade.service';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

@Injectable({
  providedIn: 'root'
})
export class AuthBootstrapUseCaseService {
  constructor(
    private readonly listingStateFacadeService: ListingStateFacadeService,
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService,
    private readonly listingAuthFacadeService: AuthFacadeService,
    private readonly listingSessionCoordinatorService: SessionCoordinatorService,
    private readonly apiSessionEventsService: ApiSessionEventsService,
    private readonly listingQueryOrchestratorService: ListingQueryOrchestratorService,
    private readonly appShellStateService: AppShellStateService
  ) {}

  async initialize(
    http: HttpClient,
    destroyRef: DestroyRef,
    frontendHost: string,
    selectedLanguageKey: string
  ): Promise<void> {
    this.appShellStateService.selectedLanguage.set(
      this.listingStateFacadeService.loadSelectedLanguageFromSession(selectedLanguageKey)
    );

    this.bindUnauthorizedSessionReset(http, destroyRef);

    const config = await this.listingStateFacadeService.loadBackendConfiguration(http);
    this.apiRuntimeConfigService.setConfiguration(config);
    this.appShellStateService.backendBaseUrl.set(this.apiRuntimeConfigService.getBackendBaseUrl());
    this.appShellStateService.staticMediaBaseUrl.set(this.apiRuntimeConfigService.getStaticMediaBaseUrl());
    this.appShellStateService.googleMapsApiKey.set(config.googleMapsApiKey);
    this.appShellStateService.googleMapsMapId.set(config.googleMapsMapId);
    this.listingAuthFacadeService.warnIfAuthHostMismatch(frontendHost);

    const googleLoginEnabled = await this.listingAuthFacadeService.loadGoogleLoginAvailability(http);
    this.appShellStateService.googleLoginEnabled.set(googleLoginEnabled);

    await this.listingSessionCoordinatorService.loadCurrentUserAndApplyState(http);
  }

  private bindUnauthorizedSessionReset(http: HttpClient, destroyRef: DestroyRef): void {
    this.apiSessionEventsService.unauthorized$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        if (this.appShellStateService.authenticatedUser() === null) {
          return;
        }

        this.appShellStateService.authenticatedUser.set(null);
        this.appShellStateService.users.set([]);
        this.listingQueryOrchestratorService.resetGuestListingState();
        if (
          this.appShellStateService.activeTab() === 'USERS_TAB' ||
          this.appShellStateService.activeTab() === 'DATABASE_MAINTENANCE_TAB'
        ) {
          this.appShellStateService.activeTab.set('DASHBOARD');
        }
        void this.listingQueryOrchestratorService.refreshListingData(http);
      });
  }
}
