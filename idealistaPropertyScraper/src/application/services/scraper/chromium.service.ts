import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { Configuration } from 'src/infrastructure/config/configuration';
import { ChromiumPageSyncService } from 'src/application/services/scraper/chromium/chromium-page-sync.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/scraper/chromium/chromium-process-lifecycle.service';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { ChromiumFailureGuardService } from 'src/application/services/scraper/chromium/chromium-failure-guard.service';
import { ChromiumGeolocationService } from 'src/application/services/scraper/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/scraper/chromium/chromium-network-headers.service';
import { InfrastructurePreCheckService } from 'src/application/services/scraper/infrastructure-pre-check.service';
import { ScraperCdpClient } from 'src/application/services/scraper/chromium/scraper-cdp-client.type';
import { ScrapeNewPropertiesFlowService } from 'src/application/services/scraper/flows/scrape-new-properties-flow.service';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';

@Injectable()
export class ChromiumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChromiumService.name);
  private readonly browserFailureHoldMs = 60 * 60 * 1000;
  private readonly initialHardeningStabilizationWaitMs = 5000;
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;
  private shuttingDown = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly chromiumProcessLifecycleService: ChromiumProcessLifecycleService,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly infrastructurePreCheckService: InfrastructurePreCheckService,
    private readonly scraperStateLoopService: ScraperStateLoopService,
    private readonly imageDownloader: ImageDownloader,
    private readonly scrapeNewPropertiesFlowService: ScrapeNewPropertiesFlowService,
    private readonly updateExistingPropertiesFlowService: UpdateExistingPropertiesFlowService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.infrastructurePreCheckService.runBeforeScraperStartup();
      await this.launchChrome();
      await this.loadHomePageOnce();
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
    await this.waitForCdp();
    await this.chromiumGeolocationService.grantStartupPermissions(this.cdpHost, this.cdpPort);
    this.chromiumGeolocationService.startTargetLoop(this.cdpHost, this.cdpPort, () => this.shuttingDown);
    this.chromiumNetworkHeadersService.startTargetLoop(this.cdpHost, this.cdpPort, () => this.shuttingDown);
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


  private async loadHomePageOnce(): Promise<void> {
    const selectedTarget = await this.waitForPageTarget();
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Loading initial home page on target ${String((selectedTarget as { id?: string }).id ?? 'unknown')}.`);
    const client = await CDP({ host: this.cdpHost, port: this.cdpPort, target: selectedTarget }) as ScraperCdpClient;

    try {
      const { Page, Runtime } = client;
      await Page.enable();
      await Runtime.enable();
      const initialUrl = await Runtime.evaluate({
        expression: 'window.location.href',
        returnByValue: true
      });
      const initialUrlValue = String(initialUrl.result?.value ?? '').trim();
      if (initialUrlValue !== 'about:blank') {
        this.logger.warn(`Initial target URL is "${initialUrlValue}". Forcing about:blank before first hardened navigation.`);
        await Page.navigate({ url: 'about:blank' });
        await this.chromiumPageSyncService.waitForPageLoad(
          Page,
          Runtime,
          this.configuration.chromeCdpReadyTimeoutMs,
          this.configuration.chromeCdpPollIntervalMs
        );
      }

      await this.chromiumNetworkHeadersService.applyHeaders(client);
      this.chromiumGeolocationService.registerPageNavigationListener(client, Page);
      await this.chromiumGeolocationService.ensureOriginIsAuthorized(client, this.configuration.scraperHomeUrl);
      await this.chromiumGeolocationService.applyGeolocationOverride(client);
      this.logger.log(`Waiting ${Math.floor(this.initialHardeningStabilizationWaitMs / 1000)} seconds after hardening before first target navigation.`);
      await this.chromiumPageSyncService.sleep(this.initialHardeningStabilizationWaitMs);
      await Page.navigate({ url: this.configuration.scraperHomeUrl });
      await this.chromiumPageSyncService.waitForPageLoad(
        Page,
        Runtime,
        this.configuration.chromeCdpReadyTimeoutMs,
        this.configuration.chromeCdpPollIntervalMs
      );
      this.logger.log('Initial home page load complete. Scraper will remain idle until requested.');
    } finally {
      await client.close();
    }
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
    const selectedTarget = await this.waitForPageTarget();
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Using page target ${String((selectedTarget as { id?: string }).id ?? 'unknown')} for ${stateLabel} state.`);
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
