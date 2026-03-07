import { Injectable, Logger } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { Configuration } from 'src/infrastructure/config/configuration';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { ChromiumFailureGuardService } from 'src/application/services/scraper/chromium/chromium-failure-guard.service';
import { ChromiumGeolocationService } from 'src/application/services/scraper/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/scraper/chromium/chromium-network-headers.service';
import { ScraperCdpClient } from 'src/application/services/scraper/chromium/scraper-cdp-client.type';
import { ChromiumPageTargetService } from 'src/application/services/scraper/chromium/chromium-page-target.service';
import { ScrapeNewPropertiesFlowService } from 'src/application/services/scraper/flows/scrape-new-properties-flow.service';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';

@Injectable()
export class ScraperOrchestratorService {
  private readonly logger = new Logger(ScraperOrchestratorService.name);
  private readonly browserFailureHoldMs = 60 * 60 * 1000;

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageTargetService: ChromiumPageTargetService,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly scraperStateLoopService: ScraperStateLoopService,
    private readonly imageDownloader: ImageDownloader,
    private readonly scrapeNewPropertiesFlowService: ScrapeNewPropertiesFlowService,
    private readonly updateExistingPropertiesFlowService: UpdateExistingPropertiesFlowService
  ) {}

  start(params: {
    cdpHost: string;
    cdpPort: number;
    isShuttingDown: () => boolean;
  }): void {
    this.scraperStateLoopService.start({
      onScrapingForNewProperties: async () => this.runScrapeNewPropertiesCycle(params.cdpHost, params.cdpPort),
      onUpdatingProperties: async () => this.runUpdateExistingPropertiesCycle(params.cdpHost, params.cdpPort),
      onLoopError: async (error: unknown) => {
        await this.chromiumFailureGuardService.holdForDebug(
          `Scraper state loop failed. ${this.errorToMessage(error)}`,
          this.browserFailureHoldMs,
          params.isShuttingDown
        );
      },
      isShuttingDown: params.isShuttingDown
    });
  }

  private async runScrapeNewPropertiesCycle(cdpHost: string, cdpPort: number): Promise<void> {
    await this.withHardenedClient(cdpHost, cdpPort, 'SCRAPING_FOR_NEW_PROPERTIES', async (client) => {
      await this.scrapeNewPropertiesFlowService.execute(client);
    });
  }

  private async runUpdateExistingPropertiesCycle(cdpHost: string, cdpPort: number): Promise<void> {
    await this.withHardenedClient(cdpHost, cdpPort, 'UPDATING_PROPERTIES', async (client) => {
      await this.updateExistingPropertiesFlowService.execute(client);
    });
  }

  private async withHardenedClient(
    cdpHost: string,
    cdpPort: number,
    stateLabel: string,
    operation: (client: ScraperCdpClient) => Promise<void>
  ): Promise<void> {
    const selectedTarget = await this.chromiumPageTargetService.waitForPageTarget(cdpHost, cdpPort);
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Using page target ${String(selectedTarget.id ?? 'unknown')} for ${stateLabel} state.`);
    const client = await CDP({ host: cdpHost, port: cdpPort, target: selectedTarget }) as ScraperCdpClient;

    try {
      const { Page, Runtime } = client;
      await Page.enable();
      await Runtime.enable();
      await this.chromiumNetworkHeadersService.applyHeaders(client);
      this.chromiumGeolocationService.registerPageNavigationListener(client, Page);
      await this.chromiumGeolocationService.ensureOriginIsAuthorized(client, this.configuration.scraperHomeUrl);
      await this.chromiumGeolocationService.applyGeolocationOverride(client);
      await this.imageDownloader.initializeNetworkCapture(client);
      await Page.bringToFront();
      await operation(client);
    } finally {
      await client.close();
    }
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
