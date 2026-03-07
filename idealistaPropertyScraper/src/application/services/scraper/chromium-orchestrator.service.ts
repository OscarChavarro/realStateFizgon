import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { Configuration } from 'src/infrastructure/config/configuration';
import { ChromiumCdpReadinessService } from 'src/application/services/scraper/chromium/chromium-cdp-readiness.service';
import { ChromiumPageTargetService } from 'src/application/services/scraper/chromium/chromium-page-target.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/scraper/chromium/chromium-process-lifecycle.service';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { ChromiumFailureGuardService } from 'src/application/services/scraper/chromium/chromium-failure-guard.service';
import { ChromiumGeolocationService } from 'src/application/services/scraper/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/scraper/chromium/chromium-network-headers.service';
import { InfrastructurePreCheckService } from 'src/application/services/scraper/infrastructure-pre-check.service';
import { ScraperCdpClient } from 'src/application/services/scraper/chromium/scraper-cdp-client.type';
import { HomeSearchPreparationFlowService } from 'src/application/services/scraper/flows/home-search-preparation-flow.service';
import { ScrapeNewPropertiesFlowService } from 'src/application/services/scraper/flows/scrape-new-properties-flow.service';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';

@Injectable()
export class ChromiumOrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChromiumOrchestratorService.name);
  private readonly browserFailureHoldMs = 60 * 60 * 1000;
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;
  private shuttingDown = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumCdpReadinessService: ChromiumCdpReadinessService,
    private readonly chromiumPageTargetService: ChromiumPageTargetService,
    private readonly chromiumProcessLifecycleService: ChromiumProcessLifecycleService,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly infrastructurePreCheckService: InfrastructurePreCheckService,
    private readonly scraperStateLoopService: ScraperStateLoopService,
    private readonly imageDownloader: ImageDownloader,
    private readonly homeSearchPreparationFlowService: HomeSearchPreparationFlowService,
    private readonly scrapeNewPropertiesFlowService: ScrapeNewPropertiesFlowService,
    private readonly updateExistingPropertiesFlowService: UpdateExistingPropertiesFlowService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.infrastructurePreCheckService.runBeforeScraperStartup();
      await this.launchChrome();
      await this.homeSearchPreparationFlowService.execute(this.cdpHost, this.cdpPort);
      this.scraperStateLoopService.start({
        onScrapingForNewProperties: async () => this.runScrapeNewPropertiesCycle(),
        onUpdatingProperties: async () => this.runUpdateExistingPropertiesCycle(),
        onLoopError: async (error: unknown) => {
          await this.chromiumFailureGuardService.holdForDebug(
            `Scraper state loop failed. ${this.errorToMessage(error)}`,
            this.browserFailureHoldMs,
            () => this.shuttingDown
          );
        },
        isShuttingDown: () => this.shuttingDown
      });
    } catch (error) {
      await this.chromiumFailureGuardService.holdForDebug(
        `Browser startup flow failed. ${this.errorToMessage(error)}`,
        this.browserFailureHoldMs,
        () => this.shuttingDown
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    this.chromiumProcessLifecycleService.stopChromiumProcess();
  }

  private async launchChrome(): Promise<void> {
    await this.chromiumProcessLifecycleService.launchChromiumProcess(
      this.cdpPort,
      (code, signal) => {
        void this.chromiumFailureGuardService.handleUnexpectedChromeExit({
          code,
          signal,
          cdpHost: this.cdpHost,
          cdpPort: this.cdpPort,
          browserFailureHoldMs: this.browserFailureHoldMs,
          isShuttingDown: () => this.shuttingDown
        });
      },
      () => this.shuttingDown
    );
    await this.chromiumCdpReadinessService.waitForReadyEndpoint(this.cdpHost, this.cdpPort);
    await this.chromiumGeolocationService.grantStartupPermissions(this.cdpHost, this.cdpPort);
    this.chromiumGeolocationService.startTargetLoop(this.cdpHost, this.cdpPort, () => this.shuttingDown);
    this.chromiumNetworkHeadersService.startTargetLoop(this.cdpHost, this.cdpPort, () => this.shuttingDown);
  }

  private async runScrapeNewPropertiesCycle(): Promise<void> {
    await this.withHardenedClient('SCRAPING_FOR_NEW_PROPERTIES', async (client) => {
      await this.scrapeNewPropertiesFlowService.execute(client);
    });
  }

  private async runUpdateExistingPropertiesCycle(): Promise<void> {
    await this.withHardenedClient('UPDATING_PROPERTIES', async (client) => {
      await this.updateExistingPropertiesFlowService.execute(client);
    });
  }

  private async withHardenedClient(
    stateLabel: string,
    operation: (client: ScraperCdpClient) => Promise<void>
  ): Promise<void> {
    const selectedTarget = await this.chromiumPageTargetService.waitForPageTarget(this.cdpHost, this.cdpPort);
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Using page target ${String(selectedTarget.id ?? 'unknown')} for ${stateLabel} state.`);
    const client = await CDP({ host: this.cdpHost, port: this.cdpPort, target: selectedTarget }) as ScraperCdpClient;

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
