import { Inject, Injectable } from '@nestjs/common';
import { PropertyUrl } from 'domain/property/property-url';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { CLOCK_PORT } from 'ports/outbound/timing/clock.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
import type { ClockPort } from 'ports/outbound/timing/clock.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';
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

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    @Inject(CLOCK_PORT) private readonly clockPort: ClockPort,
    @Inject(SLEEP_PORT)
    private readonly sleepPort: SleepPort
  ) {}

  async clickPropertyLinkFromResults(runtime: RuntimeClient, targetUrl: string): Promise<boolean> {
    const targetPropertyId = PropertyUrl.extractPropertyId(targetUrl);
    if (!targetPropertyId) {
      return false;
    }

    return await this.evaluateExpression<boolean>(runtime, `(() => {
      const propertyPathRegex = new RegExp(${JSON.stringify(PropertyUrl.INMUEBLE_PATH_REGEX_SOURCE)}, 'i');
      const extractPropertyId = (value) => {
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

        const match = parsed.pathname.match(propertyPathRegex);
        if (!match) {
          return null;
        }

        return match[1] || null;
      };

      const targetPropertyId = ${JSON.stringify(targetPropertyId)};

      const anchors = Array.from(document.querySelectorAll('article.item a.item-link[href], article.item a[href*="/inmueble/"]'));
      const link = anchors.find((anchor) => extractPropertyId(anchor.getAttribute('href') || '') === targetPropertyId);
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
    const timeout = this.chromeConfig.chromeCdpReadyTimeoutMs;
    const start = this.clockPort.nowMs();

    while (this.clockPort.nowMs() - start < timeout) {
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

      await this.sleepPort.sleep(this.chromeConfig.chromeCdpPollIntervalMs);
    }

    throw new Error(`Timeout waiting for target URL to load: ${targetUrl}`);
  }

  async navigateDirectlyToUrl(runtime: RuntimeClient, targetUrl: string): Promise<void> {
    await runtime.evaluate({
      expression: `window.location.href = ${JSON.stringify(targetUrl)}; true;`,
      returnByValue: true
    });
    await this.waitForDetailUrlAndDomComplete(runtime, targetUrl);
  }

  async goBackToSearchResults(runtime: RuntimeClient): Promise<void> {
    await runtime.evaluate({
      expression: 'window.history.back(); true;',
      returnByValue: true
    });

    const timeout = this.chromeConfig.chromeCdpReadyTimeoutMs;
    const start = this.clockPort.nowMs();
    while (this.clockPort.nowMs() - start < timeout) {
      const isReady = await this.evaluateExpression<boolean>(runtime, PropertyDetailNavigationService.SEARCH_RESULTS_READY_EXPRESSION);

      if (isReady) {
        return;
      }

      await this.sleepPort.sleep(this.chromeConfig.chromeCdpPollIntervalMs);
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

}
