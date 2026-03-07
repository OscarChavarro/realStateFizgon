import { Module } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'src/application/services/scraper/chromium/chromium-failure-guard.service';
import { ChromiumGeolocationService } from 'src/application/services/scraper/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/scraper/chromium/chromium-network-headers.service';
import { ChromiumPageSyncService } from 'src/application/services/scraper/chromium/chromium-page-sync.service';
import { ChromiumPermissionRegistrarService } from 'src/application/services/scraper/chromium/chromium-permission-registrar.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/scraper/chromium/chromium-process-lifecycle.service';
import { ChromiumUserAgentTlsService } from 'src/application/services/scraper/chromium/chromium-user-agent-tls.service';
import { ConfigurationModule } from 'src/infrastructure/config/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [
    ChromiumPageSyncService,
    ChromiumFailureGuardService,
    ChromiumPermissionRegistrarService,
    ChromiumUserAgentTlsService,
    ChromiumProcessLifecycleService,
    ChromiumGeolocationService,
    ChromiumNetworkHeadersService
  ],
  exports: [
    ChromiumPageSyncService,
    ChromiumFailureGuardService,
    ChromiumProcessLifecycleService,
    ChromiumGeolocationService,
    ChromiumNetworkHeadersService
  ]
})
export class ScraperChromiumModule {}
