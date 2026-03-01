import { Injectable, Logger } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { Configuration } from '../../config/configuration';
import { FiltersService } from './filters/filters.service';
import { MainPageService } from './main-page.service';
import { ChromiumPageSyncService } from './chromium-page-sync.service';
import { PropertyListPageService } from './property/property-list-page.service';

type RuntimeDomain = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

type PageDomain = {
  navigate(params: { url: string }): Promise<void>;
  reload(params?: { ignoreCache?: boolean }): Promise<void>;
  loadEventFired(cb: () => void): void;
};

type FilterClient = {
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
  };
  Runtime: {
    enable(): Promise<void>;
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
  };
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
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async prepareSearchResultsWithFilters(client: FilterClient, page: PageDomain, runtime: RuntimeDomain): Promise<void> {
    const locationResult = await runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true
    });
    const currentUrl = String(locationResult.result?.value ?? '');
    this.logger.log(`Current page URL before automation: ${currentUrl}`);
    if (!currentUrl.startsWith(this.configuration.scraperHomeUrl)) {
      await page.navigate({ url: this.configuration.scraperHomeUrl });
      await this.chromiumPageSyncService.waitForPageLoad(page);
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
    client: {
      Runtime: {
        enable(): Promise<void>;
        evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
      };
    },
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
        await this.chromiumPageSyncService.waitForPageLoad(page);
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
      await this.chromiumPageSyncService.waitForPageLoad(page);
    }

    throw new Error('Origin error page persisted after automatic reload attempts.');
  }

  private async hasOriginError(runtime: RuntimeDomain): Promise<boolean> {
    const evaluation = await runtime.evaluate({
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
}

