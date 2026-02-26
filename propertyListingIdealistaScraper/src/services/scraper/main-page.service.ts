import { Injectable, Logger } from '@nestjs/common';
import { Configuration } from '../../config/configuration';

type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
    description?: string;
  };
};

type CdpClient = {
  Runtime: {
    enable(): Promise<void>;
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
};

@Injectable()
export class MainPageService {
  private readonly logger = new Logger(MainPageService.name);

  constructor(private readonly configuration: Configuration) {}

  async execute(client: CdpClient, mainSearchArea: string, scraperHomeUrl: string): Promise<void> {
    this.logger.log(`Main page automation started for ${scraperHomeUrl}`);
    await client.Runtime.enable();

    await this.waitForExpression(
      client,
      `Boolean(
        document.querySelector('fieldset.new-radio-button label[for="free-search-operation-rent"]')
        || document.querySelector('label[for="free-search-operation-rent"]')
        || document.querySelector('#free-search-operation-rent')
        || document.querySelector('input[name="operation"][value="rent"]')
        || document.querySelector('#campoBus')
      )`
    );
    this.logger.log('Step 1/3: Rent controls ready, selecting "Alquilar" when available.');

    await this.evaluateOrThrow(
      client,
      `(() => {
        const rentLabel = document.querySelector(
          'fieldset.new-radio-button label[for="free-search-operation-rent"], label[for="free-search-operation-rent"]'
        );
        if (rentLabel) {
          rentLabel.click();
          return true;
        }

        const rentInput = document.querySelector(
          '#free-search-operation-rent, input[name="operation"][value="rent"]'
        );
        if (rentInput) {
          rentInput.checked = true;
          rentInput.dispatchEvent(new Event('input', { bubbles: true }));
          rentInput.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        if (document.querySelector('#campoBus')) {
          return true;
        }

        throw new Error('Rent controls were not found');
      })()`
    );
    this.logger.log('Step 1/3 completed.');

    await this.waitForExpression(client, "Boolean(document.querySelector('#campoBus'))");
    this.logger.log(`Step 2/3: Search input found, typing "${mainSearchArea}".`);

    await this.evaluateOrThrow(
      client,
      `(() => {
        const input = document.querySelector('#campoBus');
        if (!input) {
          throw new Error('Input #campoBus was not found');
        }
        const value = ${JSON.stringify(mainSearchArea)};
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'd' }));
        return true;
      })()`
    );
    this.logger.log('Step 2/3 completed.');

    await new Promise((resolve) => setTimeout(resolve, this.configuration.mainPageSearchClickWaitMs));

    await this.waitForExpression(
      client,
      "Boolean(document.querySelector('#btn-free-search, .btn-free-search, [id=\"btn-free-search\"]'))"
    );
    this.logger.log('Step 3/3: Search button found, clicking "Buscar".');

    await this.evaluateOrThrow(
      client,
      `(() => {
        const button = document.querySelector('#btn-free-search, .btn-free-search, [id="btn-free-search"]');
        if (!button) {
          throw new Error('Search button btn-free-search was not found');
        }
        button.click();
        return true;
      })()`
    );
    this.logger.log('Step 3/3 completed.');

    await this.waitForExpression(
      client,
      `(() => {
        const normalizeUrl = (value) => (value || '').replace(/\\/$/, '');
        const home = normalizeUrl(${JSON.stringify(scraperHomeUrl)});
        const current = normalizeUrl(window.location.href);
        const changedUrl = current !== home;
        const hasResultsDom = Boolean(
          document.querySelector('#aside-filters')
          || document.querySelector('.pagination')
          || document.querySelector('article.item')
          || document.querySelector('.items-container')
          || document.querySelector('.item-info-container')
        );
        return changedUrl || hasResultsDom;
      })()`
    );
    this.logger.log('Search results state detected (URL changed or results DOM is present).');
  }

  private async waitForExpression(client: CdpClient, expression: string): Promise<void> {
    const timeout = this.configuration.mainPageExpressionTimeoutMs;
    const start = Date.now();
    let lastCurrentUrl = '';
    let lastTitle = '';

    while (Date.now() - start < timeout) {
      const evaluation = await client.Runtime.evaluate({
        expression: `(() => {
          const matched = (${expression});
          const title = (document.title || '').toLowerCase();
          const text = (document.body?.innerText || '').toLowerCase();
          const currentUrl = window.location.href;
          const hasOriginError = title.includes('425 unknown error')
            || title.includes('unknown error')
            || text.includes('error 425 unknown error')
            || text.includes('error 425')
            || text.includes('unknown error')
            || text.includes('error 54113')
            || text.includes('varnish cache server');
          return { matched, hasOriginError, currentUrl, title };
        })()`,
        returnByValue: true
      });

      if (evaluation.exceptionDetails?.text) {
        throw new Error(evaluation.exceptionDetails.text);
      }

      const value = evaluation.result?.value as {
        matched?: unknown;
        hasOriginError?: unknown;
        currentUrl?: unknown;
        title?: unknown;
      } | undefined;
      lastCurrentUrl = String(value?.currentUrl ?? '');
      lastTitle = String(value?.title ?? '');
      if (value?.hasOriginError === true) {
        throw new Error(`Origin error page detected while waiting for expression: ${expression}`);
      }

      if (value?.matched === true) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, this.configuration.mainPageExpressionPollIntervalMs));
    }

    throw new Error(
      `Timeout waiting for expression: ${expression}. Last URL="${lastCurrentUrl}", title="${lastTitle}".`
    );
  }

  private async evaluateOrThrow(client: CdpClient, expression: string): Promise<void> {
    const result = await client.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    if (result.result?.description?.startsWith('Error:')) {
      throw new Error(result.result.description);
    }
  }
}
