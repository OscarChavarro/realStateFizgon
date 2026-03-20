import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { CAPTCHA_DETECTOR_PORT } from 'ports/outbound/captcha/captcha-detector.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { CaptchaDetectorPort } from 'ports/outbound/captcha/captcha-detector.port';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';
@Injectable()
export class PaginateAndProcessListingsUseCase {
  private readonly logger = new Logger(PaginateAndProcessListingsUseCase.name);

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly scraperConfig: ScraperConfig,
    private readonly propertyListPageService: PropertyListPageService,
    @Inject(CAPTCHA_DETECTOR_PORT)
    private readonly captchaDetectorPort: CaptchaDetectorPort,
    @Inject(SLEEP_PORT) private readonly sleepPort: SleepPort
  ) {}

  async execute(client: PropertyCdpClient): Promise<void> {
    let page = 1;

    while (true) {
      await this.captchaDetectorPort.panicIfCaptchaDetected({
        runtime: client.Runtime,
        logger: this.logger,
        context: `property listing page ${page}`
      });
      const pageUrls = await this.propertyListPageService.getPropertyUrls(client);
      await this.propertyListPageService.processUrls(client, pageUrls);

      const hasNext = await this.hasNextButton(client);
      if (!hasNext) {
        this.logger.log(`Pagination finished at page ${page}.`);
        return;
      }

      const currentUrl = await this.getCurrentUrl(client);
      const clicked = await this.clickNextButton(client);
      if (!clicked) {
        this.logger.warn('Next button exists but could not be clicked. Stopping pagination.');
        return;
      }

      await this.sleepPort.sleep(this.scraperConfig.paginationClickWaitMs);
      await this.waitForUrlChange(client, currentUrl);
      await this.waitForListingsOrPagination(client);
      await this.captchaDetectorPort.panicIfCaptchaDetected({
        runtime: client.Runtime,
        logger: this.logger,
        context: `property listing page ${page + 1}`
      });
      page += 1;
      this.logger.log(`Moved to page ${page}.`);
    }
  }

  private async hasNextButton(client: PropertyCdpClient): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => Boolean(document.querySelector('.pagination li.next a[href]')))()`,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }

  private async getCurrentUrl(client: PropertyCdpClient): Promise<string> {
    const result = await client.Runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return String(result.result?.value ?? '');
  }

  private async clickNextButton(client: PropertyCdpClient): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const next = document.querySelector('.pagination li.next a[href]');
        if (!next) {
          return false;
        }
        if (typeof next.click === 'function') {
          next.click();
        } else {
          next.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
        return true;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }

  private async waitForUrlChange(client: PropertyCdpClient, previousUrl: string): Promise<void> {
    const timeout = this.chromeConfig.chromeExpressionTimeoutMs;
    const pollInterval = this.chromeConfig.chromeExpressionPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const currentUrl = await this.getCurrentUrl(client);
      if (currentUrl !== previousUrl) {
        return;
      }
      await this.sleepPort.sleep(pollInterval);
    }

    throw new Error(`Timeout waiting for pagination URL change from ${previousUrl}`);
  }

  private async waitForListingsOrPagination(client: PropertyCdpClient): Promise<void> {
    const timeout = this.chromeConfig.chromeExpressionTimeoutMs;
    const pollInterval = this.chromeConfig.chromeExpressionPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = await client.Runtime.evaluate({
        expression: `(() => {
          return Boolean(
            document.querySelector('.pagination')
            || document.querySelector('article.item, .item-info-container, .items-container')
          );
        })()`,
        returnByValue: true
      });

      if (result.exceptionDetails?.text) {
        throw new Error(result.exceptionDetails.text);
      }

      if (result.result?.value === true) {
        return;
      }

      await this.sleepPort.sleep(pollInterval);
    }

    throw new Error('Timeout waiting for listings/pagination after moving to next page.');
  }
}
