import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ProxyService } from '@real-state-fizgon/proxy';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { Configuration } from '../../config/configuration';
import { ChromiumPageSyncService } from './chromium-page-sync.service';
import { ChromiumProcessLiveCicleService } from './chromium-process-live-cicle.service';
import { FiltersService } from './filters/filters.service';
import { MainPageService } from './main-page.service';
import { PropertyListingPaginationService } from './pagination/property-listing-pagination.service';
import { MongoDatabaseService } from '../mongodb/mongo-database.service';
import { ImageDownloader } from '../imagedownload/image-downloader';
import { PropertyListPageService } from './property/property-list-page.service';

@Injectable()
export class ChromiumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChromiumService.name);
  private readonly browserFailureHoldMs = 60 * 60 * 1000;
  private readonly proxyService = new ProxyService();
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;
  private shuttingDown = false;
  private debugHoldInProgress = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly chromiumProcessLiveCicleService: ChromiumProcessLiveCicleService,
    private readonly mainPageService: MainPageService,
    private readonly filtersService: FiltersService,
    private readonly propertyListingPaginationService: PropertyListingPaginationService,
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
      await this.openHomePage();
    } catch (error) {
      await this.holdForDebug(
        `Browser startup flow failed. ${this.errorToMessage(error)}`
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
        void this.handleUnexpectedChromeExit(code, signal);
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
      const locationResult = await Runtime.evaluate({
        expression: 'window.location.href',
        returnByValue: true
      });
      const currentUrl = String(locationResult.result?.value ?? '');
      this.logger.log(`Current page URL before automation: ${currentUrl}`);
      if (!currentUrl.startsWith(this.configuration.scraperHomeUrl)) {
        await Page.navigate({ url: this.configuration.scraperHomeUrl });
        await this.chromiumPageSyncService.waitForPageLoad(Page);
        await this.captchaDetectorService.panicIfCaptchaDetected({
          runtime: Runtime,
          logger: this.logger,
          context: 'listing home page navigation'
        });
      }
      this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
      await this.executeMainPageWithRetry(client, Page, Runtime);
      await this.captchaDetectorService.panicIfCaptchaDetected({
        runtime: Runtime,
        logger: this.logger,
        context: 'listing search results page load'
      });
      await this.chromiumPageSyncService.waitForExpression(
        Runtime,
        "Boolean(document.querySelector('#aside-filters'))",
        this.configuration.chromeExpressionTimeoutMs,
        this.configuration.chromeExpressionPollIntervalMs
      );
      await this.filtersService.execute(client);
      await this.propertyListingPaginationService.execute(client);
      this.logger.log('MainPageService finished.');
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

  private async recoverIfOriginError(Page: { reload(params?: { ignoreCache?: boolean }): Promise<void>; loadEventFired(cb: () => void): void }, Runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const hasOriginError = await this.hasOriginError(Runtime);
      if (!hasOriginError) {
        return;
      }

      this.logger.warn(`Detected origin error page (attempt ${attempt}/${maxRetries}). Reloading in 1 second.`);
      await this.chromiumPageSyncService.sleep(this.configuration.chromeOriginErrorReloadWaitMs);
      await Page.reload({ ignoreCache: true });
      await this.chromiumPageSyncService.waitForPageLoad(Page);
    }

    throw new Error('Origin error page persisted after automatic reload attempts.');
  }

  private async executeMainPageWithRetry(
    client: {
      Runtime: {
        enable(): Promise<void>;
        evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
      };
    },
    Page: { navigate(params: { url: string }): Promise<void>; reload(params?: { ignoreCache?: boolean }): Promise<void>; loadEventFired(cb: () => void): void },
    Runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.recoverIfOriginError(Page, Runtime);
        this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
        await this.mainPageService.execute(
          client,
          this.configuration.mainSearchArea,
          this.configuration.scraperHomeUrl
        );
        await this.recoverIfOriginError(Page, Runtime);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isOriginErrorVisible = await this.hasOriginError(Runtime);

        if (attempt === maxAttempts) {
          throw error;
        }

        this.logger.warn(
          `Main page flow failed (attempt ${attempt}/${maxAttempts}): ${message}. Reloading home and retrying.`
        );
        await this.chromiumPageSyncService.sleep(this.configuration.chromeOriginErrorReloadWaitMs);

        if (isOriginErrorVisible) {
          await Page.reload({ ignoreCache: true });
        } else {
          await Page.navigate({ url: this.configuration.scraperHomeUrl });
        }
        await this.chromiumPageSyncService.waitForPageLoad(Page);
      }
    }
  }

  private async hasOriginError(Runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }): Promise<boolean> {
    const evaluation = await Runtime.evaluate({
      expression: `(() => {
        const title = (document.title || '').toLowerCase();
        const text = (document.body?.innerText || '').toLowerCase();
        return title.includes('425 unknown error')
          || title.includes('unknown error')
          || text.includes('error 425 unknown error')
          || text.includes('error 425')
          || text.includes('unknown error')
          || text.includes('error 54113')
          || text.includes('varnish cache server');
      })()`,
      returnByValue: true
    });

    return evaluation.result?.value === true;
  }

  private async handleUnexpectedChromeExit(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    const codeText = code === null ? 'null' : String(code);
    const signalText = signal ?? 'null';
    this.logger.error(`Chrome process exited unexpectedly (code=${codeText}, signal=${signalText}).`);

    const cdpStillReachable = await this.isCdpReachableAfterExit();
    if (cdpStillReachable) {
      this.logger.warn('Chrome launcher process exited, but CDP is still reachable. Continuing without shutting down.');
      return;
    }

    await this.holdForDebug('CDP connection to the browser was lost.');
  }

  private async isCdpReachableAfterExit(): Promise<boolean> {
    const attempts = 5;
    const waitMs = 250;

    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.configuration.chromeCdpRequestTimeoutMs);
      try {
        const response = await fetch(`http://${this.cdpHost}:${this.cdpPort}/json/version`, {
          signal: controller.signal
        });
        if (response.ok) {
          return true;
        }
      } catch {
        // Keep retrying; this is expected while Chrome is transitioning.
      } finally {
        clearTimeout(timer);
      }

      await this.chromiumPageSyncService.sleep(waitMs);
    }

    return false;
  }

  private async holdForDebug(reason: string): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    if (this.debugHoldInProgress) {
      this.logger.warn('Debug hold is already active; keeping current hold window.');
      return;
    }

    this.debugHoldInProgress = true;
    const waitSeconds = Math.floor(this.browserFailureHoldMs / 1000);

    this.logger.error(`Browser failure detected: ${reason}`);
    this.logger.error(
      `Keeping microservice alive for ${waitSeconds} seconds so the pod can be inspected.`
    );

    try {
      await this.chromiumPageSyncService.sleep(this.browserFailureHoldMs);
    } finally {
      this.debugHoldInProgress = false;
      this.logger.warn('Debug hold finished. Browser automation is still stopped.');
    }
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
