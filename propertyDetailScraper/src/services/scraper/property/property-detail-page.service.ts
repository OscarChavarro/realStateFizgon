import { Injectable } from '@nestjs/common';
import { Configuration } from '../../../config/configuration';

type CdpClient = {
  Page: {
    bringToFront(): Promise<void>;
    navigate(params: { url: string }): Promise<{ errorText?: string }>;
  };
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }>;
  };
};

@Injectable()
export class PropertyDetailPageService {
  constructor(private readonly configuration: Configuration) {}

  async loadPropertyUrl(client: CdpClient, url: string): Promise<void> {
    await client.Page.bringToFront();
    const navigation = await client.Page.navigate({ url });
    if (navigation.errorText) {
      throw new Error(`Navigation failed: ${navigation.errorText}`);
    }
    await this.waitForUrlAndDomComplete(client.Runtime, url);
    await this.scrollPageToBottomAndBackToTop(client.Runtime);
    await this.extendAllPhotos(client.Runtime);
  }

  async extendAllPhotos(
    runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }
  ): Promise<void> {
    const clicked = await this.clickMorePhotosIfExists(runtime);
    if (!clicked) {
      return;
    }

    await this.sleep(this.configuration.propertyDetailPageScrollIntervalMs);
    await this.scrollPageToBottomAndBackToTop(runtime);
  }

  private async waitForUrlAndDomComplete(
    runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> },
    targetUrl: string
  ): Promise<void> {
    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const evaluation = await runtime.evaluate({
        expression: `(() => {
          const currentNoHash = window.location.href.split('#')[0];
          const targetNoHash = ${JSON.stringify(targetUrl)}.split('#')[0];
          const sameUrl = currentNoHash === targetNoHash;
          const isComplete = document.readyState === 'complete';
          return sameUrl && isComplete;
        })()`,
        returnByValue: true
      });

      if (evaluation.result?.value === true) {
        return;
      }

      await this.sleep(this.configuration.chromeCdpPollIntervalMs);
    }

    throw new Error(`Timeout waiting for target URL to load: ${targetUrl}`);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async scrollPageToBottomAndBackToTop(
    runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }
  ): Promise<void> {
    const events = Math.max(1, this.configuration.propertyDetailPageScrollEvents);
    const interval = Math.max(0, this.configuration.propertyDetailPageScrollIntervalMs);

    for (let step = 0; step <= events; step += 1) {
      const progress = step / events;
      await runtime.evaluate({
        expression: `(() => {
          const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          window.scrollTo(0, Math.round(maxScroll * ${progress}));
          return true;
        })()`,
        returnByValue: true
      });
      await this.sleep(interval);
    }

    await runtime.evaluate({
      expression: 'window.scrollTo(0, 0); true;',
      returnByValue: true
    });
  }

  private async clickMorePhotosIfExists(
    runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }
  ): Promise<boolean> {
    const result = await runtime.evaluate({
      expression: `(() => {
        const button = document.querySelector('a.btn.regular.more-photos');
        if (!button) {
          return false;
        }
        if (typeof button.click === 'function') {
          button.click();
        } else {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
        return true;
      })()`,
      returnByValue: true
    });

    return result.result?.value === true;
  }
}
