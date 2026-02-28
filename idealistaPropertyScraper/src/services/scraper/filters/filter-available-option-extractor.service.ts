import { Injectable } from '@nestjs/common';
import { CdpClient } from './cdp-client.type';
import { MinMaxOptions } from './min-max-options.type';

@Injectable()
export class FilterAvailableOptionExtractor {
  async extractSingleSelectorDropdownOptions(client: CdpClient, selector: string): Promise<string[]> {
    return this.evaluateStringArray(
      client,
      `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return [];
        }

        const values = Array.from(
          root.querySelectorAll('ul.dropdown-list-refresh > li, ul.dropdown-list > li, ul.dropdown > li')
        )
          .map((node) => normalize(node.textContent))
          .filter((value) => value.length > 0);

        return Array.from(new Set(values));
      })()`
    );
  }

  async extractMultipleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
    return this.evaluateStringArray(
      client,
      `(() => {
        const normalize = (value) => (value || '')
          .replace(/Desplegar/g, '')
          .replace(/\\s+/g, ' ')
          .trim();

        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return [];
        }

        const values = Array.from(root.querySelectorAll('input[type="checkbox"], input[type="radio"]'))
          .map((input) => {
            const label = input.closest('label');
            if (!label) {
              return '';
            }
            const content = label.querySelector('span > span');
            return normalize(content ? content.textContent : label.textContent);
          })
          .filter((value) => value.length > 0);

        return Array.from(new Set(values));
      })()`
    );
  }

  async extractSingleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
    return this.evaluateStringArray(
      client,
      `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return [];
        }

        const values = Array.from(root.querySelectorAll('label.input-radio'))
          .map((label) => {
            const content = label.querySelector('span > span');
            return normalize(content ? content.textContent : label.textContent);
          })
          .filter((value) => value.length > 0);

        return Array.from(new Set(values));
      })()`
    );
  }

  async extractMinMaxOptions(client: CdpClient, selector: string): Promise<MinMaxOptions> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return { minOptions: [], maxOptions: [] };
        }

        const dropdowns = Array.from(root.querySelectorAll(':scope > .dropdown-list'));
        const minContainer = dropdowns[0];
        const maxContainer = dropdowns[1];

        const readValues = (container) => {
          if (!container) {
            return [];
          }
          const values = Array.from(container.querySelectorAll('ul.dropdown-list.dropdown-insertion > li, ul.dropdown > li, ul.dropdown-list > li'))
            .map((node) => normalize(node.textContent))
            .filter((value) => value.length > 0);
          return Array.from(new Set(values));
        };

        return {
          minOptions: readValues(minContainer),
          maxOptions: readValues(maxContainer)
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    const value = result.result?.value as MinMaxOptions | undefined;
    if (!value) {
      return { minOptions: [], maxOptions: [] };
    }

    return {
      minOptions: Array.isArray(value.minOptions) ? value.minOptions.filter((item): item is string => typeof item === 'string') : [],
      maxOptions: Array.isArray(value.maxOptions) ? value.maxOptions.filter((item): item is string => typeof item === 'string') : []
    };
  }

  private async evaluateStringArray(client: CdpClient, expression: string): Promise<string[]> {
    const result = await client.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    const value = result.result?.value;
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }
}
