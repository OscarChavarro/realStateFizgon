import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { OriginErrorDetectorService } from 'application/services/resilience/origin-error-detector.service';
import { FiltersService } from 'application/services/scraper/filters/filters.service';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { ExecuteMainSearchFormUseCase } from 'application/usecases/scraper/execute-main-search-form.use-case';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';
import { CAPTCHA_DETECTOR_PORT } from 'ports/outbound/captcha/captcha-detector.port.token';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { CaptchaDetectorPort } from 'ports/outbound/captcha/captcha-detector.port';
import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
type RuntimeDomain = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

type PageDomain = {
  navigate(params: { url: string }): Promise<void>;
  reload(params?: { ignoreCache?: boolean }): Promise<void>;
  loadEventFired(cb: () => void): void;
};

@Injectable()
export class PrepareSearchResultsUseCase {
  private readonly logger = new Logger(PrepareSearchResultsUseCase.name);
  private firstHomePageWaitApplied = false;

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly executeMainSearchFormUseCase: ExecuteMainSearchFormUseCase,
    private readonly filtersService: FiltersService,
    private readonly propertyListPageService: PropertyListPageService,
    private readonly originErrorDetectorService: OriginErrorDetectorService,
    @Inject(CAPTCHA_DETECTOR_PORT)
    private readonly captchaDetectorPort: CaptchaDetectorPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  async execute(client: FiltersCdpClient, page: PageDomain, runtime: RuntimeDomain): Promise<void> {
    const locationResult = await runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true
    });
    const currentUrl = String(locationResult.result?.value ?? '');
    this.logger.log(`Current page URL before automation: ${currentUrl}`);
    if (!currentUrl.startsWith(this.scraperConfig.scraperHomeUrl)) {
      await page.navigate({ url: this.scraperConfig.scraperHomeUrl });
      await this.chromiumPageSyncService.waitForPageLoad(
        page,
        runtime,
        this.chromeConfig.chromeCdpReadyTimeoutMs,
        this.chromeConfig.chromeCdpPollIntervalMs
      );
      await this.captchaDetectorPort.panicIfCaptchaDetected({
        runtime,
        logger: this.logger,
        context: 'listing home page navigation'
      });
    }

    await this.waitForFirstHomePageDeviceVerification();
    this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
    await this.executeMainPageWithRetry(client, page, runtime);
    await this.captchaDetectorPort.panicIfCaptchaDetected({
      runtime,
      logger: this.logger,
      context: 'listing search results page load'
    });
    await this.chromiumPageSyncService.waitForExpression(
      runtime,
      "Boolean(document.querySelector('#aside-filters'))",
      this.chromeConfig.chromeExpressionTimeoutMs,
      this.chromeConfig.chromeExpressionPollIntervalMs
    );
    await this.filtersService.execute(client);
  }

  private async waitForFirstHomePageDeviceVerification(): Promise<void> {
    if (this.firstHomePageWaitApplied) {
      return;
    }

    this.firstHomePageWaitApplied = true;
    const waitMs = this.scraperConfig.mainPageFirstLoadDeviceVerificationWaitMs;
    const waitSeconds = Math.floor(waitMs / 1000);

    this.logger.log(
      `First home-page load detected. Waiting ${waitSeconds} seconds for device verification to complete before search automation.`
    );
    await this.chromiumPageSyncService.sleep(waitMs);
  }

  private async executeMainPageWithRetry(
    client: FiltersCdpClient,
    page: PageDomain,
    runtime: RuntimeDomain
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.recoverIfOriginError(page, runtime);
        this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
        await this.executeMainSearchFormUseCase.execute(
          client,
          this.scraperConfig.mainSearchArea,
          this.scraperConfig.scraperHomeUrl
        );
        await this.recoverIfOriginError(page, runtime);
        return;
      } catch (error) {
        const message = this.errorMessagePort.toErrorMessage(error);
        const isOriginErrorVisible = await this.hasOriginError(runtime);

        if (attempt === maxAttempts) {
          throw error;
        }

        this.logger.warn(
          `Main page flow failed (attempt ${attempt}/${maxAttempts}): ${message}. Reloading home and retrying.`
        );
        await this.chromiumPageSyncService.sleep(this.chromeConfig.chromeOriginErrorReloadWaitMs);

        if (isOriginErrorVisible) {
          await page.reload({ ignoreCache: true });
        } else {
          await page.navigate({ url: this.scraperConfig.scraperHomeUrl });
        }
        await this.chromiumPageSyncService.waitForPageLoad(
          page,
          runtime,
          this.chromeConfig.chromeCdpReadyTimeoutMs,
          this.chromeConfig.chromeCdpPollIntervalMs
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
      await this.chromiumPageSyncService.sleep(this.chromeConfig.chromeOriginErrorReloadWaitMs);
      await page.reload({ ignoreCache: true });
      await this.chromiumPageSyncService.waitForPageLoad(
        page,
        runtime,
        this.chromeConfig.chromeCdpReadyTimeoutMs,
        this.chromeConfig.chromeCdpPollIntervalMs
      );
    }

    throw new Error('Origin error page persisted after automatic reload attempts.');
  }

  private async hasOriginError(runtime: RuntimeDomain): Promise<boolean> {
    return this.originErrorDetectorService.hasOriginError(runtime);
  }
}
