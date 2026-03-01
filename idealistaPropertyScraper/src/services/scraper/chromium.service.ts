import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ProxyService } from '@real-state-fizgon/proxy';
import { Configuration } from '../../config/configuration';
import { ChromiumPageSyncService } from './chromium-page-sync.service';
import { ChromiumProcessLiveCicleService } from './chromium-process-live-cicle.service';
import { PropertyListingPaginationService } from './pagination/property-listing-pagination.service';
import { MongoDatabaseService } from '../mongodb/mongo-database.service';
import { ImageDownloader } from '../imagedownload/image-downloader';
import { PropertyListPageService } from './property/property-list-page.service';
import { ScraperState } from '../../states/scraper-state.enum';
import { ScraperStateMachineService } from '../../states/scraper-state-machine.service';
import { SearchResultsPreparationService } from './search-results-preparation.service';
import { ChromiumFailureGuardService } from './chromium-failure-guard.service';

@Injectable()
export class ChromiumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChromiumService.name);
  private readonly browserFailureHoldMs = 60 * 60 * 1000;
  private readonly proxyService = new ProxyService();
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;
  private shuttingDown = false;
  private scraperLoopRunning = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly chromiumProcessLiveCicleService: ChromiumProcessLiveCicleService,
    private readonly searchResultsPreparationService: SearchResultsPreparationService,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly propertyListingPaginationService: PropertyListingPaginationService,
    private readonly scraperStateMachineService: ScraperStateMachineService,
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly imageDownloader: ImageDownloader,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.proxyService.validateProxyAccessOrWait({
        enabled: this.configuration.proxyEnabled,
        host: this.configuration.proxyHost,
        port: this.configuration.proxyPort,
        retryWaitMs: this.configuration.chromeBrowserLaunchRetryWaitMs,
        logger: this.logger
      });
      await this.mongoDatabaseService.validateConnectionOrExit();
      await this.imageDownloader.validateImageDownloadFolder();
      await this.launchChrome();
      this.startScraperStateLoop();
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
    this.chromiumProcessLiveCicleService.stopChromiumProcess();
  }

  private async launchChrome(): Promise<void> {
    await this.chromiumProcessLiveCicleService.launchChromiumProcess(
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
    await this.waitForCdp();
  }

  private async waitForCdp(): Promise<void> {
    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();
    let lastError: unknown;

    while (Date.now() - start < timeout) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.configuration.chromeCdpRequestTimeoutMs);

      try {
        const response = await fetch(`http://${this.cdpHost}:${this.cdpPort}/json/version`, {
          signal: controller.signal
        });
        if (response.ok) {
          this.logger.log(`CDP endpoint is ready at ${this.cdpHost}:${this.cdpPort}.`);
          return;
        }
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }

      await this.chromiumPageSyncService.sleep(this.configuration.chromeCdpPollIntervalMs);
    }

    throw new Error(
      `CDP endpoint did not become available in time at ${this.cdpHost}:${this.cdpPort}${lastError ? ` (${String(lastError)})` : ''}`
    );
  }

  private async runScraperStateLoop(): Promise<void> {
    while (!this.shuttingDown) {
      const currentState = this.scraperStateMachineService.getCurrentState();
      if (currentState === ScraperState.SCRAPING_FOR_NEW_PROPERTIES) {
        await this.openHomePage();
        continue;
      }

      if (currentState === ScraperState.UPDATING_PROPERTIES) {
        await this.updatePropertiesFromDatabase();
        continue;
      }

      if (
        currentState === ScraperState.IDLE
        && this.scraperStateMachineService.getPendingRequestsCount() > 0
      ) {
        this.scraperStateMachineService.setState(ScraperState.UPDATING_PROPERTIES);
        continue;
      }

      await this.chromiumPageSyncService.sleep(500);
    }
  }

  private startScraperStateLoop(): void {
    if (this.scraperLoopRunning) {
      return;
    }

    this.scraperLoopRunning = true;
    void this.runScraperStateLoop()
      .catch(async (error) => {
        await this.chromiumFailureGuardService.holdForDebug(
          `Scraper state loop failed. ${this.errorToMessage(error)}`,
          this.browserFailureHoldMs,
          () => this.shuttingDown
        );
      })
      .finally(() => {
        this.scraperLoopRunning = false;
      });
  }

  private async openHomePage(): Promise<void> {
    const selectedTarget = await this.waitForPageTarget();
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Using page target ${String((selectedTarget as { id?: string }).id ?? 'unknown')}.`);
    const client = await CDP({ host: this.cdpHost, port: this.cdpPort, target: selectedTarget });

    try {
      const { Page, Runtime } = client;
      await Page.enable();
      await Runtime.enable();
      await this.imageDownloader.initializeNetworkCapture(client as unknown as {
        Network: {
          enable(): Promise<void>;
          responseReceived(callback: (event: unknown) => void): void;
          loadingFinished(callback: (event: unknown) => void): void;
          loadingFailed(callback: (event: unknown) => void): void;
          getResponseBody(params: { requestId: string }): Promise<{ body: string; base64Encoded: boolean }>;
        };
      });
      await Page.bringToFront();
      await this.searchResultsPreparationService.prepareSearchResultsWithFilters(client, Page, Runtime);
      await this.propertyListingPaginationService.execute(client);
      this.logger.log('MainPageService finished.');
      this.scraperStateMachineService.finishScrapingForNewPropertiesCycle();
    } finally {
      await client.close();
    }
  }

  private async updatePropertiesFromDatabase(): Promise<void> {
    const selectedTarget = await this.waitForPageTarget();
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Using page target ${String((selectedTarget as { id?: string }).id ?? 'unknown')} for UPDATING_PROPERTIES state.`);
    const client = await CDP({ host: this.cdpHost, port: this.cdpPort, target: selectedTarget });

    try {
      const { Page, Runtime } = client;
      await Page.enable();
      await Runtime.enable();
      await this.imageDownloader.initializeNetworkCapture(client as unknown as {
        Network: {
          enable(): Promise<void>;
          responseReceived(callback: (event: unknown) => void): void;
          loadingFinished(callback: (event: unknown) => void): void;
          loadingFailed(callback: (event: unknown) => void): void;
          getResponseBody(params: { requestId: string }): Promise<{ body: string; base64Encoded: boolean }>;
        };
      });
      await Page.bringToFront();
      await this.searchResultsPreparationService.prepareSearchResultsWithFilters(client, Page, Runtime);

      const openUrls = await this.mongoDatabaseService.getOpenPropertyUrls();
      this.logger.log(`UPDATING_PROPERTIES: revalidating ${openUrls.length} open properties from MongoDB.`);
      this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
      await this.propertyListPageService.processExistingUrls(client, openUrls);
      this.scraperStateMachineService.finishUpdatingPropertiesCycle();
      this.logger.log('UPDATING_PROPERTIES cycle finished.');
    } finally {
      await client.close();
    }
  }

  private async waitForPageTarget(): Promise<{ id?: string; url?: string; type?: string } | undefined> {
    const timeoutMs = this.configuration.chromeCdpReadyTimeoutMs;
    const pollIntervalMs = this.configuration.chromeCdpPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const targets = await CDP.List({ host: this.cdpHost, port: this.cdpPort });
      const pageTargets = [...targets]
        .filter((target: { type?: string }) => target.type === 'page')
        .filter((target: { url?: string }) => {
          const url = (target.url ?? '').trim().toLowerCase();
          return !url.startsWith('devtools://');
        });

      const preferredTarget = pageTargets.find((target: { url?: string }) => {
        const url = (target.url ?? '').trim();
        return url.startsWith(this.configuration.scraperHomeUrl);
      }) ?? pageTargets[0] ?? [...targets].reverse().find((target: { type?: string }) => target.type === 'page');

      if (preferredTarget) {
        return preferredTarget as { id?: string; url?: string; type?: string };
      }

      await this.chromiumPageSyncService.sleep(pollIntervalMs);
    }

    return undefined;
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
