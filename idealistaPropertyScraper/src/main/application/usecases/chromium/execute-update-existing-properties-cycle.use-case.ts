import { Inject, Injectable, Logger } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'application/services/chromium/chromium-network-headers.service';
import { ChromiumPageTargetService } from 'application/services/chromium/chromium-page-target.service';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'application/usecases/scraper/execute-update-existing-properties-flow.use-case';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class ExecuteUpdateExistingPropertiesCycleUseCase {
  private readonly logger = new Logger(ExecuteUpdateExistingPropertiesCycleUseCase.name);

  constructor(
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort,
    private readonly chromiumPageTargetService: ChromiumPageTargetService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly imageDownloader: ImageDownloaderService,
    private readonly executeUpdateExistingPropertiesFlowUseCase: ExecuteUpdateExistingPropertiesFlowUseCase
  ) {}

  async execute(cdpHost: string, cdpPort: number): Promise<void> {
    const selectedTarget = await this.chromiumPageTargetService.waitForPageTarget(cdpHost, cdpPort);
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Using page target ${String(selectedTarget.id ?? 'unknown')} for UPDATING_PROPERTIES state.`);
    const client = await CDP({ host: cdpHost, port: cdpPort, target: selectedTarget }) as ScraperCdpClient;

    try {
      const { Page, Runtime } = client;
      await Page.enable();
      await Runtime.enable();
      await this.chromiumNetworkHeadersService.applyHeaders(client);
      this.chromiumGeolocationService.registerPageNavigationListener(client, Page);
      await this.chromiumGeolocationService.ensureOriginIsAuthorized(client, this.scraperConfig.scraperHomeUrl);
      await this.chromiumGeolocationService.applyGeolocationOverride(client);
      await this.imageDownloader.initializeNetworkCapture(client);
      await Page.bringToFront();
      await this.executeUpdateExistingPropertiesFlowUseCase.execute(client);
    } finally {
      await client.close();
    }
  }
}
