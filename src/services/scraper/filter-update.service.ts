import { Injectable, Logger } from '@nestjs/common';
import { Configuration } from '../../config/configuration';
import { Filter } from './filters/filter.interface';
import { FilterType } from './filters/filter-type.enum';
import { SupportedFilters } from './filters/supported-filters';

type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

type CdpClient = {
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
};

type MinMaxSelection = {
  selectedMin: string | null;
  selectedMax: string | null;
};

@Injectable()
export class FilterUpdateService {
  private readonly logger = new Logger(FilterUpdateService.name);
  private readonly maxReconciliationAttempts = 4;

  constructor(private readonly configuration: Configuration) {}

  async applyRequiredActions(
    client: CdpClient,
    preloadedFiltersFromConfiguration: SupportedFilters,
    extractedFiltersFromDom: SupportedFilters
  ): Promise<void> {
    const preloaded = preloadedFiltersFromConfiguration.getSupportedFilters();
    const extractedCount = extractedFiltersFromDom.getSupportedFilters().length;
    this.logger.log(`Reconciling ${preloaded.length} filters against current DOM (${extractedCount} extracted).`);

    for (const expectedFilter of preloaded) {
      await this.reconcileFilter(client, expectedFilter);
    }
  }

  private async reconcileFilter(client: CdpClient, expectedFilter: Filter): Promise<void> {
    for (let attempt = 1; attempt <= this.maxReconciliationAttempts; attempt += 1) {
      if (expectedFilter.getType() === FilterType.MIN_MAX) {
        const currentSelection = await this.readCurrentMinMaxSelection(client, expectedFilter.getCssSelector());
        const hasDiff = this.hasMinMaxDiff(expectedFilter, currentSelection);

        if (!hasDiff) {
          return;
        }

        await this.applyMinMaxActions(client, expectedFilter, currentSelection);
      } else {
        const currentSelection = await this.readCurrentPlainSelection(client, expectedFilter);
        const { toEnable, toDisable } = this.getPlainSelectionDiff(
          expectedFilter.getSelectedPlainOptions(),
          currentSelection
        );

        if (toEnable.length === 0 && toDisable.length === 0) {
          return;
        }

        await this.applyPlainSelectionActions(client, expectedFilter, toEnable, toDisable);
      }

      await this.sleep(this.configuration.filterStateClickWaitMs);
    }

    this.logger.warn(`Could not fully reconcile filter ${expectedFilter.getName()} after retries.`);
  }

  private hasMinMaxDiff(expectedFilter: Filter, currentSelection: MinMaxSelection): boolean {
    return expectedFilter.getSelectedMin() !== currentSelection.selectedMin
      || expectedFilter.getSelectedMax() !== currentSelection.selectedMax;
  }

  private getPlainSelectionDiff(expected: string[], current: string[]): { toEnable: string[]; toDisable: string[] } {
    const expectedSet = new Set(expected);
    const currentSet = new Set(current);

    const toEnable = expected.filter((option) => !currentSet.has(option));
    const toDisable = current.filter((option) => !expectedSet.has(option));

    return { toEnable, toDisable };
  }

  private async applyPlainSelectionActions(
    client: CdpClient,
    expectedFilter: Filter,
    toEnable: string[],
    toDisable: string[]
  ): Promise<void> {
    for (const option of toEnable) {
      const clicked = await this.clickPlainOption(client, expectedFilter.getCssSelector(), option, 'enable');
      if (clicked) {
        this.logger.log(`Click on ${option} to enable it`);
        await this.sleep(this.configuration.filterStateClickWaitMs);
      }
    }

    for (const option of toDisable) {
      const clicked = await this.clickPlainOption(client, expectedFilter.getCssSelector(), option, 'disable');
      if (clicked) {
        this.logger.log(`Click on ${option} to disable it`);
        await this.sleep(this.configuration.filterStateClickWaitMs);
      }
    }
  }

  private async applyMinMaxActions(
    client: CdpClient,
    expectedFilter: Filter,
    currentSelection: MinMaxSelection
  ): Promise<void> {
    const expectedMin = expectedFilter.getSelectedMin();
    const expectedMax = expectedFilter.getSelectedMax();

    if (expectedMin !== currentSelection.selectedMin) {
      const value = expectedMin ?? 'Mín';
      const clicked = await this.clickMinMaxOption(client, expectedFilter.getCssSelector(), 'min', value);
      if (clicked) {
        if (expectedMin === null) {
          this.logger.log(`Clear minimum value on ${expectedFilter.getName()}`);
        } else {
          this.logger.log(`Set minimum value on ${expectedFilter.getName()} to ${expectedMin}`);
        }
        await this.sleep(this.configuration.filterStateClickWaitMs);
      }
    }

    if (expectedMax !== currentSelection.selectedMax) {
      const value = expectedMax ?? 'Máx';
      const clicked = await this.clickMinMaxOption(client, expectedFilter.getCssSelector(), 'max', value);
      if (clicked) {
        if (expectedMax === null) {
          this.logger.log(`Clear maximum value on ${expectedFilter.getName()}`);
        } else {
          this.logger.log(`Set maximum value on ${expectedFilter.getName()} to ${expectedMax}`);
        }
        await this.sleep(this.configuration.filterStateClickWaitMs);
      }
    }
  }

  private async readCurrentPlainSelection(client: CdpClient, expectedFilter: Filter): Promise<string[]> {
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

  private async extractSelectedSingleSelectorDropdownOptions(client: CdpClient, selector: string): Promise<string[]> {
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

  private async readCurrentMinMaxSelection(client: CdpClient, selector: string): Promise<MinMaxSelection> {
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

  private async clickPlainOption(
    client: CdpClient,
    selector: string,
    option: string,
    mode: 'enable' | 'disable'
  ): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').replace(/Desplegar/g, '').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return false;
        }

        const target = normalize(${JSON.stringify(option)});
        const labels = Array.from(root.querySelectorAll('label'));

        for (const label of labels) {
          const input = label.querySelector('input[type="checkbox"], input[type="radio"]');
          if (!input) {
            continue;
          }

          const content = label.querySelector('span > span');
          const labelText = normalize(content ? content.textContent : label.textContent);
          if (labelText !== target) {
            continue;
          }

          const isChecked = Boolean(input.checked);
          if (${JSON.stringify(mode)} === 'enable' && !isChecked) {
            label.click();
            return true;
          }
          if (${JSON.stringify(mode)} === 'disable' && isChecked && input.type === 'checkbox') {
            label.click();
            return true;
          }
          return false;
        }

        return false;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }

  private async clickMinMaxOption(
    client: CdpClient,
    selector: string,
    role: 'min' | 'max',
    value: string
  ): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return false;
        }

        const dropdowns = Array.from(root.querySelectorAll(':scope > .dropdown-list'));
        const container = dropdowns[${role === 'min' ? 0 : 1}];
        if (!container) {
          return false;
        }

        const target = normalize(${JSON.stringify(value)});
        const current = normalize(
          container.querySelector('button.dropdown-wrapper > span.placeholder, .dropdown-wrapper > span.placeholder')?.textContent || ''
        );
        if (current === target) {
          return false;
        }

        const button = container.querySelector('button.dropdown-wrapper');
        if (button) {
          button.click();
        }

        const options = Array.from(
          container.querySelectorAll('ul.dropdown-list.dropdown-insertion > li, ul.dropdown > li, ul.dropdown-list > li')
        );

        for (const option of options) {
          const text = normalize(option.textContent);
          if (text !== target) {
            continue;
          }
          const clickable = option.querySelector('a') || option;
          clickable.click();
          return true;
        }

        return false;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
