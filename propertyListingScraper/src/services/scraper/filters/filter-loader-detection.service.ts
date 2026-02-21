import { Injectable, Logger } from '@nestjs/common';
import { Configuration } from '../../../config/configuration';

type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

type CdpClient = {
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
  };
};

@Injectable()
export class FilterLoaderDetectionService {
  private readonly logger = new Logger(FilterLoaderDetectionService.name);

  constructor(private readonly configuration: Configuration) {}

  async waitForPostClickStabilityOrReload(client: CdpClient): Promise<boolean> {
    await this.sleep(this.configuration.filterStateClickWaitMs);

    const disappeared = await this.waitForListingLoadingToDisappear(client);
    if (disappeared) {
      return true;
    }

    this.logger.warn(
      `Restarting page because #listing-loading stayed visible for more than ${this.configuration.filterListingLoadingTimeoutMs}ms.`
    );
    await client.Page.reload({ ignoreCache: true });
    await this.waitForPageLoad(client);
    await this.waitForAsideFilters(client);
    return false;
  }

  private async waitForListingLoadingToDisappear(client: CdpClient): Promise<boolean> {
    const timeout = this.configuration.filterListingLoadingTimeoutMs;
    const pollInterval = this.configuration.filterListingLoadingPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const isVisible = await this.isListingLoadingVisible(client);
      if (!isVisible) {
        return true;
      }
      await this.sleep(pollInterval);
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
    const timeout = this.configuration.filterListingLoadingTimeoutMs;
    const pollInterval = this.configuration.filterListingLoadingPollIntervalMs;
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

      await this.sleep(pollInterval);
    }

    throw new Error('Timeout waiting for #aside-filters after reload.');
  }

  private async waitForPageLoad(client: CdpClient): Promise<void> {
    await new Promise<void>((resolve) => {
      client.Page.loadEventFired(() => resolve());
    });
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
