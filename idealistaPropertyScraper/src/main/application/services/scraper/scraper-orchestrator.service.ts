import { Injectable, Logger } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/chromium/chromium-network-headers.service';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { ChromiumPageTargetService } from 'src/application/services/chromium/chromium-page-target.service';
import { ScrapeNewPropertiesFlowService } from 'src/application/services/scraper/flows/scrape-new-properties-flow.service';
import { ExecuteUpdateExistingPropertiesCycleUseCase } from 'src/application/usecases/execute-update-existing-properties-cycle.use-case';
import { RunScraperStateLoopUseCase } from 'src/application/usecases/run-scraper-state-loop.use-case';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

@Injectable()
export class ScraperOrchestratorService {
  private readonly logger = new Logger(ScraperOrchestratorService.name);
  private loopRestartScheduled = false;

  constructor(
    private readonly scraperConfig: ScraperConfig,
    private readonly chromiumPageTargetService: ChromiumPageTargetService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly imageDownloader: ImageDownloader,
    private readonly scrapeNewPropertiesFlowService: ScrapeNewPropertiesFlowService,
    private readonly executeUpdateExistingPropertiesCycleUseCase: ExecuteUpdateExistingPropertiesCycleUseCase,
    private readonly runScraperStateLoopUseCase: RunScraperStateLoopUseCase
  ) {}

  start(params: {
    cdpHost: string;
    cdpPort: number;
    isShuttingDown: () => boolean;
    onUnexpectedChromeExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    browserFailureRecoveryWaitMs: number;
  }): void {
    this.runScraperStateLoopUseCase.execute({
      cdpHost: params.cdpHost,
      cdpPort: params.cdpPort,
      isShuttingDown: params.isShuttingDown,
      onUnexpectedChromeExit: params.onUnexpectedChromeExit,
      browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs,
      onScrapingForNewProperties: async () => this.runScrapeNewPropertiesCycle(params.cdpHost, params.cdpPort),
      onUpdatingProperties: async () => this.runUpdateExistingPropertiesCycle(params.cdpHost, params.cdpPort),
      onAfterRecovery: () => this.scheduleLoopRestart(params)
    });
  }

  private scheduleLoopRestart(params: {
    cdpHost: string;
    cdpPort: number;
    isShuttingDown: () => boolean;
    onUnexpectedChromeExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    browserFailureRecoveryWaitMs: number;
  }): void {
    if (params.isShuttingDown()) {
      return;
    }

    if (this.loopRestartScheduled) {
      return;
    }

    this.loopRestartScheduled = true;
    setTimeout(() => {
      this.loopRestartScheduled = false;
      if (params.isShuttingDown()) {
        return;
      }
      this.start(params);
    }, 0);
  }

  private async runScrapeNewPropertiesCycle(cdpHost: string, cdpPort: number): Promise<void> {
    await this.withHardenedClient(cdpHost, cdpPort, 'SCRAPING_FOR_NEW_PROPERTIES', async (client) => {
      await this.scrapeNewPropertiesFlowService.execute(client);
    });
  }

  private async runUpdateExistingPropertiesCycle(cdpHost: string, cdpPort: number): Promise<void> {
    await this.executeUpdateExistingPropertiesCycleUseCase.execute(cdpHost, cdpPort);
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
      await this.chromiumGeolocationService.ensureOriginIsAuthorized(client, this.scraperConfig.scraperHomeUrl);
      await this.chromiumGeolocationService.applyGeolocationOverride(client);
      await this.imageDownloader.initializeNetworkCapture(client);
      await Page.bringToFront();
      await operation(client);
    } finally {
      await client.close();
    }
  }

}
