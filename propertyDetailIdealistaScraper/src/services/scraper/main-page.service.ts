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

  async execute(client: CdpClient): Promise<void> {
    this.logger.log(`Main page automation started for ${this.configuration.scraperHomeUrl}`);
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

    await this.waitForExpression(client, `Boolean(document.querySelector('#campoBus'))`);

    await this.evaluateOrThrow(
      client,
      `(() => {
        const input = document.querySelector('#campoBus');
        if (!input) {
          throw new Error('Input #campoBus was not found');
        }
        const value = ${JSON.stringify(this.configuration.mainSearchArea)};
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'd' }));
        return true;
      })()`
    );

    await this.sleep(this.configuration.mainPageSearchClickWaitMs);

    await this.waitForExpression(
      client,
      `Boolean(document.querySelector('#btn-free-search, .btn-free-search, [id="btn-free-search"]'))`
    );

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

    await this.waitForExpression(
      client,
      `(() => {
        const normalizeUrl = (value) => (value || '').replace(/\\/$/, '');
        const home = normalizeUrl(${JSON.stringify(this.configuration.scraperHomeUrl)});
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

    while (Date.now() - start < timeout) {
      const evaluation = await client.Runtime.evaluate({
        expression,
        returnByValue: true
      });

      if (evaluation.exceptionDetails?.text) {
        throw new Error(evaluation.exceptionDetails.text);
      }

      if (evaluation.result?.value === true) {
        return;
      }

      await this.sleep(this.configuration.mainPageExpressionPollIntervalMs);
    }

    throw new Error(`Timeout waiting for expression: ${expression}`);
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
