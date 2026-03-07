import { Injectable, Logger } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { Configuration } from 'src/infrastructure/config/configuration';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { ChromiumPageSyncService } from 'src/application/services/scraper/chromium/chromium-page-sync.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { OriginErrorDetectorService } from 'src/application/services/scraper/origin-error-detector.service';

type RuntimeDomain = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

type PageDomain = {
  navigate(params: { url: string }): Promise<void>;
  reload(params?: { ignoreCache?: boolean }): Promise<void>;
  loadEventFired(cb: () => void): void;
};

@Injectable()
export class SearchResultsPreparationService {
  private readonly logger = new Logger(SearchResultsPreparationService.name);
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();
  private firstHomePageWaitApplied = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly mainPageService: MainPageService,
    private readonly filtersService: FiltersService,
    private readonly propertyListPageService: PropertyListPageService,
    private readonly originErrorDetectorService: OriginErrorDetectorService
  ) {}

  async prepareSearchResultsWithFilters(client: CdpClient, page: PageDomain, runtime: RuntimeDomain): Promise<void> {
    const locationResult = await runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true
    });
    const currentUrl = String(locationResult.result?.value ?? '');
    this.logger.log(`Current page URL before automation: ${currentUrl}`);
    if (!currentUrl.startsWith(this.configuration.scraperHomeUrl)) {
      await page.navigate({ url: this.configuration.scraperHomeUrl });
      await this.chromiumPageSyncService.waitForPageLoad(
        page,
        runtime,
        this.configuration.chromeCdpReadyTimeoutMs,
        this.configuration.chromeCdpPollIntervalMs
      );
      await this.captchaDetectorService.panicIfCaptchaDetected({
        runtime,
        logger: this.logger,
        context: 'listing home page navigation'
      });
    }

    await this.waitForFirstHomePageDeviceVerification();
    this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
    await this.executeMainPageWithRetry(client, page, runtime);
    await this.captchaDetectorService.panicIfCaptchaDetected({
      runtime,
      logger: this.logger,
      context: 'listing search results page load'
    });
    await this.chromiumPageSyncService.waitForExpression(
      runtime,
      "Boolean(document.querySelector('#aside-filters'))",
      this.configuration.chromeExpressionTimeoutMs,
      this.configuration.chromeExpressionPollIntervalMs
    );
    await this.filtersService.execute(client);
  }

  private async waitForFirstHomePageDeviceVerification(): Promise<void> {
    if (this.firstHomePageWaitApplied) {
      return;
    }

    this.firstHomePageWaitApplied = true;
    const waitMs = this.configuration.mainPageFirstLoadDeviceVerificationWaitMs;
    const waitSeconds = Math.floor(waitMs / 1000);

    this.logger.log(
      `First home-page load detected. Waiting ${waitSeconds} seconds for device verification to complete before search automation.`
    );
    await this.chromiumPageSyncService.sleep(waitMs);
  }

  private async executeMainPageWithRetry(
    client: CdpClient,
    page: PageDomain,
    runtime: RuntimeDomain
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.recoverIfOriginError(page, runtime);
        this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
        await this.mainPageService.execute(
          client,
          this.configuration.mainSearchArea,
          this.configuration.scraperHomeUrl
        );
        await this.recoverIfOriginError(page, runtime);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isOriginErrorVisible = await this.hasOriginError(runtime);

        if (attempt === maxAttempts) {
          throw error;
        }

        this.logger.warn(
          `Main page flow failed (attempt ${attempt}/${maxAttempts}): ${message}. Reloading home and retrying.`
        );
        await this.chromiumPageSyncService.sleep(this.configuration.chromeOriginErrorReloadWaitMs);

        if (isOriginErrorVisible) {
          await page.reload({ ignoreCache: true });
        } else {
          await page.navigate({ url: this.configuration.scraperHomeUrl });
        }
        await this.chromiumPageSyncService.waitForPageLoad(
          page,
          runtime,
          this.configuration.chromeCdpReadyTimeoutMs,
          this.configuration.chromeCdpPollIntervalMs
        );
      }
    }
  }

  private async recoverIfOriginError(page: PageDomain, runtime: RuntimeDomain): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const hasOriginError = await this.hasOriginError(runtime);
      if (!hasOriginError) {
        return;
      }

      this.logger.warn(`Detected origin error page (attempt ${attempt}/${maxRetries}). Reloading in 1 second.`);
      await this.chromiumPageSyncService.sleep(this.configuration.chromeOriginErrorReloadWaitMs);
      await page.reload({ ignoreCache: true });
      await this.chromiumPageSyncService.waitForPageLoad(
        page,
        runtime,
        this.configuration.chromeCdpReadyTimeoutMs,
        this.configuration.chromeCdpPollIntervalMs
      );
    }

    throw new Error('Origin error page persisted after automatic reload attempts.');
  }

  private async hasOriginError(runtime: RuntimeDomain): Promise<boolean> {
    return this.originErrorDetectorService.hasOriginError(runtime);
  }
}
