import { Injectable } from '@nestjs/common';
import { FilterType } from 'domain/filters/filter-type';
import { MinMaxSelection } from 'application/dto/scraper/min-max-selection.dto';

import type { FilterSnapshot } from 'application/services/scraper/filters/filter-snapshot.type';
import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';

type LegacyFilterSelectionShape = {
  getType(): FilterType;
  getCssSelector(): string;
};

type PlainSelectionFilter = Pick<FilterSnapshot, 'type' | 'cssSelector'> | LegacyFilterSelectionShape;

@Injectable()
export class FilterSelectionReaderService {
  async readCurrentPlainSelection(
    client: FiltersCdpClient,
    expectedFilter: PlainSelectionFilter
  ): Promise<string[]> {
    const filterType = this.resolveFilterType(expectedFilter);
    const selector = this.resolveCssSelector(expectedFilter);

    switch (filterType) {
      case FilterType.SINGLE_SELECTOR_DROPDOWN:
        return this.extractSelectedSingleSelectorDropdownOptions(client, selector);
      case FilterType.MULTIPLE_SELECTOR:
      case FilterType.SINGLE_SELECTOR:
        return this.extractSelectedInputBasedOptions(client, selector);
      default:
        return [];
    }
  }

  async readCurrentMinMaxSelection(client: FiltersCdpClient, selector: string): Promise<MinMaxSelection> {
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

  private async extractSelectedSingleSelectorDropdownOptions(client: FiltersCdpClient, selector: string): Promise<string[]> {
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

  private async extractSelectedInputBasedOptions(client: FiltersCdpClient, selector: string): Promise<string[]> {
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

  private async evaluateStringArray(client: FiltersCdpClient, expression: string): Promise<string[]> {
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

  private resolveFilterType(filter: PlainSelectionFilter): FilterType {
    if (this.isLegacyFilterSelectionShape(filter)) {
      return filter.getType();
    }
    return (filter as Pick<FilterSnapshot, 'type'>).type;
  }

  private resolveCssSelector(filter: PlainSelectionFilter): string {
    if (this.isLegacyFilterSelectionShape(filter)) {
      return filter.getCssSelector();
    }
    return (filter as Pick<FilterSnapshot, 'cssSelector'>).cssSelector;
  }

  private isLegacyFilterSelectionShape(filter: PlainSelectionFilter): filter is LegacyFilterSelectionShape {
    return typeof (filter as Partial<LegacyFilterSelectionShape>).getType === 'function'
      && typeof (filter as Partial<LegacyFilterSelectionShape>).getCssSelector === 'function';
  }
}
