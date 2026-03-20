import { Injectable, Logger } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/chromium/chromium-network-headers.service';
import { ChromiumPageTargetService } from 'src/application/services/chromium/chromium-page-target.service';
import { ImageDownloaderService } from 'src/application/services/imagedownload/image-downloader';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

import type { ScraperCdpClient } from 'src/ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class ExecuteUpdateExistingPropertiesCycleUseCase {
  private readonly logger = new Logger(ExecuteUpdateExistingPropertiesCycleUseCase.name);

  constructor(
    private readonly scraperConfig: ScraperConfig,
    private readonly chromiumPageTargetService: ChromiumPageTargetService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly imageDownloader: ImageDownloaderService,
    private readonly updateExistingPropertiesFlowService: UpdateExistingPropertiesFlowService
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
      await this.updateExistingPropertiesFlowService.execute(client);
    } finally {
      await client.close();
    }
  }
}
