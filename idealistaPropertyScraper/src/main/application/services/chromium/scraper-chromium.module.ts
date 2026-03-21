import { Module } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { ChromiumCdpReadinessService } from 'application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumGeolocationService } from 'application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'application/services/chromium/chromium-network-headers.service';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { ChromiumPageTargetService } from 'application/services/chromium/chromium-page-target.service';
import { ChromiumPermissionRegistrarService } from 'application/services/chromium/chromium-permission-registrar.service';
import { ChromiumProcessLifecycleService } from 'application/services/chromium/chromium-process-lifecycle.service';
import { ChromiumUserAgentTlsService } from 'application/services/chromium/chromium-user-agent-tls.service';
import { ScraperStateModule } from 'application/services/state/scraper-state.module';
import { RecoverFromBrowserFailureUseCase } from 'application/usecases/resilience/recover-from-browser-failure.use-case';

@Module({
  imports: [ScraperStateModule],
  providers: [
    ChromiumPageSyncService,
    ChromiumCdpReadinessService,
    ChromiumPageTargetService,
    ChromiumFailureGuardService,
    RecoverFromBrowserFailureUseCase,
    ChromiumPermissionRegistrarService,
    ChromiumUserAgentTlsService,
    ChromiumProcessLifecycleService,
    ChromiumGeolocationService,
    ChromiumNetworkHeadersService
  ],
  exports: [
    ChromiumPageSyncService,
    ChromiumCdpReadinessService,
    ChromiumPageTargetService,
    ChromiumFailureGuardService,
    ChromiumProcessLifecycleService,
    ChromiumGeolocationService,
    ChromiumNetworkHeadersService
  ]
})
export class ScraperChromiumModule {}
