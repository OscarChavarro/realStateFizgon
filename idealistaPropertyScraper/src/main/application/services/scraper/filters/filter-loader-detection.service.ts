import { Injectable, Logger } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { sleep } from 'src/infrastructure/sleep';

@Injectable()
export class FilterLoaderDetectionService {
  private readonly logger = new Logger(FilterLoaderDetectionService.name);

  constructor(
    private readonly scraperConfig: ScraperConfig,
    private readonly chromiumPageSyncService: ChromiumPageSyncService
  ) {}

  async waitForPostClickStabilityOrReload(client: CdpClient): Promise<boolean> {
    await sleep(this.scraperConfig.filterStateClickWaitMs);

    const disappeared = await this.waitForListingLoadingToDisappear(client);
    if (disappeared) {
      return true;
    }

    this.logger.warn(
      `Restarting page because #listing-loading stayed visible for more than ${this.scraperConfig.filterListingLoadingTimeoutMs}ms.`
    );
    await client.Page.reload({ ignoreCache: true });
    await this.chromiumPageSyncService.waitForPageLoad(
      client.Page,
      client.Runtime,
      this.scraperConfig.filterListingLoadingTimeoutMs,
      this.scraperConfig.filterListingLoadingPollIntervalMs
    );
    await this.waitForAsideFilters(client);
    return false;
  }

  private async waitForListingLoadingToDisappear(client: CdpClient): Promise<boolean> {
    const timeout = this.scraperConfig.filterListingLoadingTimeoutMs;
    const pollInterval = this.scraperConfig.filterListingLoadingPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const isVisible = await this.isListingLoadingVisible(client);
      if (!isVisible) {
        return true;
      }
      await sleep(pollInterval);
    }

    const isVisibleAfterTimeout = await this.isListingLoadingVisible(client);
    return !isVisibleAfterTimeout;
  }

  private async isListingLoadingVisible(client: CdpClient): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const element = document.querySelector('#listing-loading');
        if (!element) {
          return false;
        }

        const style = window.getComputedStyle(element);
        const hasHiddenVisibility = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        const hasNoGeometry = element.offsetParent === null && element.getClientRects().length === 0;

        return !(hasHiddenVisibility || hasNoGeometry);
      })()`,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }

  private async waitForAsideFilters(client: CdpClient): Promise<void> {
    const timeout = this.scraperConfig.filterListingLoadingTimeoutMs;
    const pollInterval = this.scraperConfig.filterListingLoadingPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = await client.Runtime.evaluate({
        expression: `Boolean(document.querySelector('#aside-filters'))`,
        returnByValue: true
      });

      if (result.exceptionDetails?.text) {
        throw new Error(result.exceptionDetails.text);
      }

      if (result.result?.value === true) {
        return;
      }

      await sleep(pollInterval);
    }

    throw new Error('Timeout waiting for #aside-filters after reload.');
  }

  async scrollToTop(client: CdpClient): Promise<void> {
    const result = await client.Runtime.evaluate({
      expression: `window.scrollTo(0, 0); true;`,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }
  }

}
