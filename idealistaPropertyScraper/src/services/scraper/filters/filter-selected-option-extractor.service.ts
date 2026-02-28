import { Injectable } from '@nestjs/common';
import { CdpClient } from './cdp-client.type';
import { MinMaxSelection } from './min-max-selection.type';

@Injectable()
export class FilterSelectedOptionExtractor {
  async extractSelectedSingleSelectorDropdownOptions(client: CdpClient, selector: string): Promise<string[]> {
    return this.evaluateStringArray(
      client,
      `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return [];
        }

        const selectedValue = normalize(
          root.querySelector(':scope > button.dropdown-wrapper > span.placeholder, button.dropdown-wrapper > span.placeholder')?.textContent || ''
        );

        return selectedValue ? [selectedValue] : [];
      })()`
    );
  }

  async extractSelectedMultipleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
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

        const selected = Array.from(root.querySelectorAll('input[type="checkbox"]:checked'))
          .map((input) => {
            const label = input.closest('label');
            if (!label) {
              return '';
            }
            const content = label.querySelector('span > span');
            return normalize(content ? content.textContent : label.textContent);
          })
          .filter((value) => value.length > 0);

        return Array.from(new Set(selected));
      })()`
    );
  }

  async extractSelectedSingleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
    return this.evaluateStringArray(
      client,
      `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return [];
        }

        const selected = Array.from(root.querySelectorAll('input[type="radio"]:checked'))
          .map((input) => {
            const label = input.closest('label');
            if (!label) {
              return '';
            }
            const content = label.querySelector('span > span');
            return normalize(content ? content.textContent : label.textContent);
          })
          .filter((value) => value.length > 0);

        return Array.from(new Set(selected));
      })()`
    );
  }

  async extractSelectedMinMax(client: CdpClient, selector: string): Promise<MinMaxSelection> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return { selectedMin: null, selectedMax: null };
        }

        const dropdowns = Array.from(root.querySelectorAll(':scope > .dropdown-list'));
        const minContainer = dropdowns[0];
        const maxContainer = dropdowns[1];

        const readSelected = (container) => {
          if (!container) {
            return null;
          }
          const value = normalize(
            container.querySelector('button.dropdown-wrapper > span.placeholder, .dropdown-wrapper > span.placeholder')?.textContent || ''
          );
          return value.length > 0 ? value : null;
        };

        return {
          selectedMin: readSelected(minContainer),
          selectedMax: readSelected(maxContainer)
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    const value = result.result?.value as MinMaxSelection | undefined;
    if (!value) {
      return { selectedMin: null, selectedMax: null };
    }

    return {
      selectedMin: typeof value.selectedMin === 'string' ? value.selectedMin : null,
      selectedMax: typeof value.selectedMax === 'string' ? value.selectedMax : null
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
