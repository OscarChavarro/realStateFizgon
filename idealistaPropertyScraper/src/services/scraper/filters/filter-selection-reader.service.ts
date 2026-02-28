import { Injectable } from '@nestjs/common';
import { Filter } from './filter.interface';
import { FilterType } from '../../../model/filters/filter-type.enum';
import { CdpClient, MinMaxSelection } from './filter-cdp-client.types';

@Injectable()
export class FilterSelectionReaderService {
  async readCurrentPlainSelection(client: CdpClient, expectedFilter: Filter): Promise<string[]> {
    switch (expectedFilter.getType()) {
      case FilterType.SINGLE_SELECTOR_DROPDOWN:
        return this.extractSelectedSingleSelectorDropdownOptions(client, expectedFilter.getCssSelector());
      case FilterType.MULTIPLE_SELECTOR:
      case FilterType.SINGLE_SELECTOR:
        return this.extractSelectedInputBasedOptions(client, expectedFilter.getCssSelector());
      default:
        return [];
    }
  }

  async readCurrentMinMaxSelection(client: CdpClient, selector: string): Promise<MinMaxSelection> {
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

  private async extractSelectedSingleSelectorDropdownOptions(client: CdpClient, selector: string): Promise<string[]> {
    return this.evaluateStringArray(
      client,
      `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return [];
        }

        const hiddenInput = root.querySelector('input[type="hidden"]');
        const hiddenValue = hiddenInput && typeof hiddenInput.value === 'string'
          ? hiddenInput.value.trim()
          : '';
        if (hiddenValue.length > 0) {
          const selectedNode = root.querySelector(
            'ul.dropdown-list > li[data-value="' + hiddenValue.replace(/"/g, '\\"') + '"], ul.dropdown > li[data-value="' + hiddenValue.replace(/"/g, '\\"') + '"]'
          );
          const selectedFromHidden = normalize(selectedNode ? selectedNode.textContent : '');
          if (selectedFromHidden.length > 0) {
            return [selectedFromHidden];
          }
        }

        const selectedValue = normalize(
          root.querySelector(':scope > button.dropdown-wrapper > span.placeholder, button.dropdown-wrapper > span.placeholder')?.textContent || ''
        );

        return selectedValue ? [selectedValue] : [];
      })()`
    );
  }

  private async extractSelectedInputBasedOptions(client: CdpClient, selector: string): Promise<string[]> {
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

        const selected = Array.from(root.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked'))
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
