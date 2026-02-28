import { Injectable, Logger } from '@nestjs/common';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';
import { Configuration } from '../../config/configuration';
import { MainPageService } from './main-page.service';

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
    navigate(params: { url: string }): Promise<{ errorText?: string }>;
  };
  Runtime: {
    enable(): Promise<void>;
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
};

@Injectable()
export class SearchResultsNavigationService {
  private readonly logger = new Logger(SearchResultsNavigationService.name);
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();

  constructor(
    private readonly configuration: Configuration,
    private readonly mainPageService: MainPageService
  ) {}

  async openInitialSearchResults(client: CdpClient): Promise<string> {
    await this.navigateToUrl(client, this.configuration.scraperHomeUrl, 'main home page');
    await this.mainPageService.execute(client);
    await this.waitForResultsDom(client);
    await this.captchaDetectorService.panicIfCaptchaDetected({
      runtime: client.Runtime,
      logger: this.logger,
      context: 'initial search results page load'
    });

    const resultsUrl = await this.getCurrentUrl(client);
    this.logger.log(`Initial search results page ready: ${resultsUrl}`);
    return resultsUrl;
  }

  async goBackToSearchResults(client: CdpClient, resultsUrl: string): Promise<string> {
    await this.navigateToUrl(client, resultsUrl, 'search results page return');
    await this.waitForResultsDom(client);
    await this.captchaDetectorService.panicIfCaptchaDetected({
      runtime: client.Runtime,
      logger: this.logger,
      context: 'search results page return'
    });
    await this.sleep(this.configuration.searchResultsBackToResultsWaitMs);
    return this.getCurrentUrl(client);
  }

  async clickRandomPaginationLink(client: CdpClient): Promise<string> {
    const previousUrl = await this.getCurrentUrl(client);

    const clickResult = await client.Runtime.evaluate({
      expression: `(() => {
        const links = Array.from(document.querySelectorAll('.pagination a[href]'));
        const candidates = links.filter((link) => {
          if (!link || !link.getAttribute) {
            return false;
          }

          const href = (link.getAttribute('href') || '').trim();
          if (!href || href === '#') {
            return false;
          }

          const ariaCurrent = (link.getAttribute('aria-current') || '').toLowerCase();
          const className = (link.className || '').toLowerCase();
          if (ariaCurrent === 'page' || className.includes('active') || className.includes('selected')) {
            return false;
          }

          return true;
        });

        if (candidates.length === 0) {
          return false;
        }

        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        if (typeof selected.click === 'function') {
          selected.click();
        } else {
          selected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }

        return true;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (clickResult.exceptionDetails?.text) {
      throw new Error(clickResult.exceptionDetails.text);
    }

    if (clickResult.result?.value !== true) {
      this.logger.warn('No pagination link candidates were found for random click. Staying on current results page.');
      return previousUrl;
    }

    await this.sleep(this.configuration.searchResultsRandomPaginationClickWaitMs);
    await this.waitForUrlChangeOrResultsDom(client, previousUrl);
    await this.waitForResultsDom(client);

    const newUrl = await this.getCurrentUrl(client);
    this.logger.log(`Random pagination click moved search results from "${previousUrl}" to "${newUrl}".`);
    return newUrl;
  }

  private async navigateToUrl(client: CdpClient, url: string, context: string): Promise<void> {
    const navigation = await client.Page.navigate({ url });
    if (navigation.errorText) {
      throw new Error(`Navigation failed for ${context}: ${navigation.errorText}`);
    }

    await this.waitForReadyStateComplete(client);
  }

  private async waitForReadyStateComplete(client: CdpClient): Promise<void> {
    const timeout = this.configuration.chromeExpressionTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const evaluation = await client.Runtime.evaluate({
        expression: `document.readyState === 'complete'`,
        returnByValue: true
      });

      if (evaluation.exceptionDetails?.text) {
        throw new Error(evaluation.exceptionDetails.text);
      }

      if (evaluation.result?.value === true) {
        return;
      }

      await this.sleep(this.configuration.chromeExpressionPollIntervalMs);
    }

    throw new Error('Timeout waiting for document.readyState === "complete".');
  }

  private async waitForResultsDom(client: CdpClient): Promise<void> {
    const timeout = this.configuration.chromeExpressionTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const evaluation = await client.Runtime.evaluate({
        expression: `(() => Boolean(
          document.querySelector('#aside-filters')
          || document.querySelector('.pagination')
          || document.querySelector('article.item')
          || document.querySelector('.items-container')
          || document.querySelector('.item-info-container')
        ))()`,
        returnByValue: true
      });

      if (evaluation.exceptionDetails?.text) {
        throw new Error(evaluation.exceptionDetails.text);
      }

      if (evaluation.result?.value === true) {
        return;
      }

      await this.sleep(this.configuration.chromeExpressionPollIntervalMs);
    }

    throw new Error('Timeout waiting for search results DOM.');
  }

  private async waitForUrlChangeOrResultsDom(client: CdpClient, previousUrl: string): Promise<void> {
    const timeout = this.configuration.chromeExpressionTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const evaluation = await client.Runtime.evaluate({
        expression: `(() => {
          const currentUrl = window.location.href;
          const changedUrl = currentUrl !== ${JSON.stringify(previousUrl)};
          const hasResultsDom = Boolean(
            document.querySelector('#aside-filters')
            || document.querySelector('.pagination')
            || document.querySelector('article.item')
            || document.querySelector('.items-container')
            || document.querySelector('.item-info-container')
          );
          return changedUrl || hasResultsDom;
        })()`,
        returnByValue: true
      });

      if (evaluation.exceptionDetails?.text) {
        throw new Error(evaluation.exceptionDetails.text);
      }

      if (evaluation.result?.value === true) {
        return;
      }

      await this.sleep(this.configuration.chromeExpressionPollIntervalMs);
    }

    throw new Error('Timeout waiting for random pagination navigation to settle.');
  }

  private async getCurrentUrl(client: CdpClient): Promise<string> {
    const evaluation = await client.Runtime.evaluate({
      expression: 'window.location.href',
      returnByValue: true
    });

    if (evaluation.exceptionDetails?.text) {
      throw new Error(evaluation.exceptionDetails.text);
    }

    return String(evaluation.result?.value ?? '');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
