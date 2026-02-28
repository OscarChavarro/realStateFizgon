import { Injectable } from '@nestjs/common';
import { Configuration } from '../../../config/configuration';
import { RuntimeClient } from './cdp-client.types';

@Injectable()
export class PropertyDetailNavigationService {
  private static readonly SEARCH_RESULTS_READY_EXPRESSION = `(() => {
    const complete = document.readyState === 'complete';
    const hasResults = Boolean(
      document.querySelector('#aside-filters')
      || document.querySelector('.pagination')
      || document.querySelector('article.item')
      || document.querySelector('.items-container')
      || document.querySelector('.item-info-container')
    );
    return complete && hasResults;
  })()`;

  constructor(private readonly configuration: Configuration) {}

  async clickPropertyLinkFromResults(runtime: RuntimeClient, targetUrl: string): Promise<boolean> {
    return await this.evaluateExpression<boolean>(runtime, `(() => {
      const normalizeUrl = (value) => {
        if (!value || typeof value !== 'string') {
          return null;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return null;
        }

        let parsed;
        try {
          parsed = new URL(trimmed, window.location.origin);
        } catch {
          return null;
        }

        const match = parsed.pathname.match(/^\\/inmueble\\/(\\d+)\\/?/);
        if (!match) {
          return null;
        }

        return parsed.origin + '/inmueble/' + match[1] + '/';
      };

      const targetNormalized = normalizeUrl(${JSON.stringify(targetUrl)});
      if (!targetNormalized) {
        return false;
      }

      const anchors = Array.from(document.querySelectorAll('article.item a.item-link[href], article.item a[href*="/inmueble/"]'));
      const link = anchors.find((anchor) => normalizeUrl(anchor.getAttribute('href') || '') === targetNormalized);
      if (!link) {
        return false;
      }

      if (typeof link.click === 'function') {
        link.click();
      } else {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }

      return true;
    })()`);
  }

  async waitForDetailUrlAndDomComplete(runtime: RuntimeClient, targetUrl: string): Promise<void> {
    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const ready = await this.evaluateExpression<boolean>(runtime, `(() => {
        const currentNoHash = window.location.href.split('#')[0];
        const targetNoHash = ${JSON.stringify(targetUrl)}.split('#')[0];
        const sameUrl = currentNoHash === targetNoHash;
        const isComplete = document.readyState === 'complete';
        return sameUrl && isComplete;
      })()`);

      if (ready) {
        return;
      }

      await this.sleep(this.configuration.chromeCdpPollIntervalMs);
    }

    throw new Error(`Timeout waiting for target URL to load: ${targetUrl}`);
  }

  async goBackToSearchResults(runtime: RuntimeClient): Promise<void> {
    await runtime.evaluate({
      expression: 'window.history.back(); true;',
      returnByValue: true
    });

    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const isReady = await this.evaluateExpression<boolean>(runtime, PropertyDetailNavigationService.SEARCH_RESULTS_READY_EXPRESSION);

      if (isReady) {
        return;
      }

      await this.sleep(this.configuration.chromeCdpPollIntervalMs);
    }

    throw new Error('Timeout waiting to return to search results after detail processing.');
  }

  private async evaluateExpression<T>(runtime: RuntimeClient, expression: string): Promise<T> {
    const response = await runtime.evaluate({
      expression,
      returnByValue: true
    });

    return response.result?.value as T;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
