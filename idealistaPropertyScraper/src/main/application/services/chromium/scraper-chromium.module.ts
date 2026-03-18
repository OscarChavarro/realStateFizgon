import { Module } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'src/application/services/chromium/chromium-failure-guard.service';
import { ChromiumCdpReadinessService } from 'src/application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/chromium/chromium-network-headers.service';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ChromiumPageTargetService } from 'src/application/services/chromium/chromium-page-target.service';
import { ChromiumPermissionRegistrarService } from 'src/application/services/chromium/chromium-permission-registrar.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/chromium/chromium-process-lifecycle.service';
import { ChromiumUserAgentTlsService } from 'src/application/services/chromium/chromium-user-agent-tls.service';
import { ScraperStateModule } from 'src/application/services/state/scraper-state.module';
import { RecoverFromBrowserFailureUseCase } from 'src/application/usecases/recover-from-browser-failure.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperStateModule],
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
