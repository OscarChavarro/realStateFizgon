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
      "Boolean(document.querySelector('fieldset.new-radio-button label[for=\"free-search-operation-rent\"]'))"
    );
    this.logger.log('Step 1/3: Rent option found, clicking "Alquilar".');

    await this.evaluateOrThrow(
      client,
      `(() => {
        const rentLabel = document.querySelector('fieldset.new-radio-button label[for="free-search-operation-rent"]');
        if (!rentLabel) {
          throw new Error('Rent label was not found');
        }
        rentLabel.click();
        return true;
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
        const home = ${JSON.stringify(scraperHomeUrl)};
        const current = window.location.href;
        return current !== home && current !== home.replace(/\\/$/, '');
      })()`
    );
    this.logger.log('Navigation to search results detected.');
  }

  private async waitForExpression(client: CdpClient, expression: string): Promise<void> {
    const timeout = this.configuration.mainPageExpressionTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const evaluation = await client.Runtime.evaluate({
        expression,
        returnByValue: true
      });

      if (evaluation.result?.value === true) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, this.configuration.mainPageExpressionPollIntervalMs));
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
}
