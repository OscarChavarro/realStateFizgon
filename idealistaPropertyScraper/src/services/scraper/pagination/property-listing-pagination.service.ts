import { Injectable, Logger } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { Configuration } from '../../../config/configuration';
import { PropertyListPageService } from '../property/property-list-page.service';

type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

type CdpClient = {
  Page: {
    bringToFront(): Promise<void>;
  };
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
};

@Injectable()
export class PropertyListingPaginationService {
  private readonly logger = new Logger(PropertyListingPaginationService.name);
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();

  constructor(
    private readonly configuration: Configuration,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: CdpClient): Promise<void> {
    let page = 1;

    while (true) {
      await this.captchaDetectorService.panicIfCaptchaDetected({
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

      await this.sleep(this.configuration.paginationClickWaitMs);
      await this.waitForUrlChange(client, currentUrl);
      await this.waitForListingsOrPagination(client);
      await this.captchaDetectorService.panicIfCaptchaDetected({
        runtime: client.Runtime,
        logger: this.logger,
        context: `property listing page ${page + 1}`
      });
      page += 1;
      this.logger.log(`Moved to page ${page}.`);
    }
  }

  private async hasNextButton(client: CdpClient): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => Boolean(document.querySelector('.pagination li.next a[href]')))()`,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }

  private async getCurrentUrl(client: CdpClient): Promise<string> {
    const result = await client.Runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return String(result.result?.value ?? '');
  }

  private async clickNextButton(client: CdpClient): Promise<boolean> {
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

  private async waitForUrlChange(client: CdpClient, previousUrl: string): Promise<void> {
    const timeout = this.configuration.chromeExpressionTimeoutMs;
    const pollInterval = this.configuration.chromeExpressionPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const currentUrl = await this.getCurrentUrl(client);
      if (currentUrl !== previousUrl) {
        return;
      }
      await this.sleep(pollInterval);
    }

    throw new Error(`Timeout waiting for pagination URL change from ${previousUrl}`);
  }

  private async waitForListingsOrPagination(client: CdpClient): Promise<void> {
    const timeout = this.configuration.chromeExpressionTimeoutMs;
    const pollInterval = this.configuration.chromeExpressionPollIntervalMs;
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

      await this.sleep(pollInterval);
    }

    throw new Error('Timeout waiting for listings/pagination after moving to next page.');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
