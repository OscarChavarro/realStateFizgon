import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';
import { CLOCK_PORT } from 'ports/outbound/timing/clock.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
import type { ClockPort } from 'ports/outbound/timing/clock.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';
@Injectable()
export class FilterLoaderDetectionService {
  private readonly logger = new Logger(FilterLoaderDetectionService.name);

  constructor(
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    @Inject(CLOCK_PORT) private readonly clockPort: ClockPort,
    @Inject(SLEEP_PORT)
    private readonly sleepPort: SleepPort
  ) {}

  async waitForPostClickStabilityOrReload(client: FiltersCdpClient): Promise<boolean> {
    await this.sleepPort.sleep(this.scraperConfig.filterStateClickWaitMs);

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

  private async waitForListingLoadingToDisappear(client: FiltersCdpClient): Promise<boolean> {
    const timeout = this.scraperConfig.filterListingLoadingTimeoutMs;
    const pollInterval = this.scraperConfig.filterListingLoadingPollIntervalMs;
    const start = this.clockPort.nowMs();

    while (this.clockPort.nowMs() - start < timeout) {
      const isVisible = await this.isListingLoadingVisible(client);
      if (!isVisible) {
        return true;
      }
      await this.sleepPort.sleep(pollInterval);
    }

    const isVisibleAfterTimeout = await this.isListingLoadingVisible(client);
    return !isVisibleAfterTimeout;
  }

  private async isListingLoadingVisible(client: FiltersCdpClient): Promise<boolean> {
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

  private async waitForAsideFilters(client: FiltersCdpClient): Promise<void> {
    const timeout = this.scraperConfig.filterListingLoadingTimeoutMs;
    const pollInterval = this.scraperConfig.filterListingLoadingPollIntervalMs;
    const start = this.clockPort.nowMs();

    while (this.clockPort.nowMs() - start < timeout) {
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

      await this.sleepPort.sleep(pollInterval);
    }

    throw new Error('Timeout waiting for #aside-filters after reload.');
  }

  async scrollToTop(client: FiltersCdpClient): Promise<void> {
    const result = await client.Runtime.evaluate({
      expression: `window.scrollTo(0, 0); true;`,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }
  }

}
