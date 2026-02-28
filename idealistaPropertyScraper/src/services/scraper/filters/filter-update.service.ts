import { Injectable, Logger } from '@nestjs/common';
import { FilterLoaderDetectionService } from './filter-loader-detection.service';
import { Filter } from './filter.interface';
import { FilterType } from '../../../model/filters/filter-type.enum';
import { SupportedFilters } from './supported-filters';

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
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
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
  private readonly maxFullReconciliationPasses = 4;

  constructor(private readonly filterLoaderDetectionService: FilterLoaderDetectionService) {}

  async applyRequiredActions(
    client: CdpClient,
    preloadedFiltersFromConfiguration: SupportedFilters,
    extractedFiltersFromDom: SupportedFilters
  ): Promise<void> {
    const preloaded = preloadedFiltersFromConfiguration.getSupportedFilters();
    const extractedCount = extractedFiltersFromDom.getSupportedFilters().length;
    this.logger.log(`Reconciling ${preloaded.length} filters against current DOM (${extractedCount} extracted).`);

    for (let pass = 1; pass <= this.maxFullReconciliationPasses; pass += 1) {
      let restartFromBeginning = false;

      for (const expectedFilter of preloaded) {
        const shouldRestart = await this.reconcileFilter(client, expectedFilter);
        if (shouldRestart) {
          restartFromBeginning = true;
          break;
        }
      }

      if (!restartFromBeginning) {
        return;
      }

      this.logger.warn(`Restarting filter reconciliation from the beginning (pass ${pass}/${this.maxFullReconciliationPasses}).`);
    }

    this.logger.warn('Reached maximum full reconciliation passes.');
  }

  private async reconcileFilter(client: CdpClient, expectedFilter: Filter): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxReconciliationAttempts; attempt += 1) {
      if (expectedFilter.getType() === FilterType.MIN_MAX) {
        const currentSelection = await this.readCurrentMinMaxSelection(client, expectedFilter.getCssSelector());
        const hasDiff = this.hasMinMaxDiff(expectedFilter, currentSelection);

        if (!hasDiff) {
          return false;
        }

        const shouldRestart = await this.applyMinMaxActions(client, expectedFilter, currentSelection);
        if (shouldRestart) {
          return true;
        }
      } else {
        const currentSelection = await this.readCurrentPlainSelection(client, expectedFilter);
        const { toEnable, toDisable } = this.getPlainSelectionDiff(
          expectedFilter.getSelectedPlainOptions(),
          currentSelection
        );

        if (toEnable.length === 0 && toDisable.length === 0) {
          return false;
        }

        const shouldRestart = await this.applyPlainSelectionActions(client, expectedFilter, toEnable, toDisable);
        if (shouldRestart) {
          return true;
        }
      }

    }

    this.logger.warn(`Could not fully reconcile filter ${expectedFilter.getName()} after retries.`);
    return false;
  }

  private hasMinMaxDiff(expectedFilter: Filter, currentSelection: MinMaxSelection): boolean {
    return expectedFilter.getSelectedMin() !== currentSelection.selectedMin
      || expectedFilter.getSelectedMax() !== currentSelection.selectedMax;
  }

  private getPlainSelectionDiff(expected: string[], current: string[]): { toEnable: string[]; toDisable: string[] } {
    const expectedNormalizedSet = new Set(expected.map((option) => this.normalizeComparableText(option)));
    const currentNormalizedSet = new Set(current.map((option) => this.normalizeComparableText(option)));

    const toEnable = expected.filter(
      (option) => !currentNormalizedSet.has(this.normalizeComparableText(option))
    );
    const toDisable = current.filter(
      (option) => !expectedNormalizedSet.has(this.normalizeComparableText(option))
    );

    return { toEnable, toDisable };
  }

  private async applyPlainSelectionActions(
    client: CdpClient,
    expectedFilter: Filter,
    toEnable: string[],
    toDisable: string[]
  ): Promise<boolean> {
    if (expectedFilter.getType() === FilterType.SINGLE_SELECTOR_DROPDOWN) {
      for (const option of toEnable) {
        const clicked = await this.clickSingleSelectorDropdownOption(client, expectedFilter.getCssSelector(), option);
        if (clicked) {
          await this.filterLoaderDetectionService.scrollToTop(client);
          const stable = await this.filterLoaderDetectionService.waitForPostClickStabilityOrReload(client);
          if (!stable) {
            return true;
          }
        }
      }

      return false;
    }

    for (const option of toEnable) {
      const clicked = await this.clickPlainOption(client, expectedFilter.getCssSelector(), option, 'enable');
      if (clicked) {
        await this.filterLoaderDetectionService.scrollToTop(client);
        const stable = await this.filterLoaderDetectionService.waitForPostClickStabilityOrReload(client);
        if (!stable) {
          return true;
        }
      }
    }

    for (const option of toDisable) {
      const clicked = await this.clickPlainOption(client, expectedFilter.getCssSelector(), option, 'disable');
      if (clicked) {
        await this.filterLoaderDetectionService.scrollToTop(client);
        const stable = await this.filterLoaderDetectionService.waitForPostClickStabilityOrReload(client);
        if (!stable) {
          return true;
        }
      }
    }

    return false;
  }

  private async applyMinMaxActions(
    client: CdpClient,
    expectedFilter: Filter,
    currentSelection: MinMaxSelection
  ): Promise<boolean> {
    const expectedMin = expectedFilter.getSelectedMin();
    const expectedMax = expectedFilter.getSelectedMax();

    if (expectedMin !== currentSelection.selectedMin) {
      const value = expectedMin ?? 'Mín';
      const clicked = await this.clickMinMaxOption(client, expectedFilter.getCssSelector(), 'min', value);
      if (clicked) {
        await this.filterLoaderDetectionService.scrollToTop(client);
        const stable = await this.filterLoaderDetectionService.waitForPostClickStabilityOrReload(client);
        if (!stable) {
          return true;
        }
      }
    }

    if (expectedMax !== currentSelection.selectedMax) {
      const value = expectedMax ?? 'Máx';
      const clicked = await this.clickMinMaxOption(client, expectedFilter.getCssSelector(), 'max', value);
      if (clicked) {
        await this.filterLoaderDetectionService.scrollToTop(client);
        const stable = await this.filterLoaderDetectionService.waitForPostClickStabilityOrReload(client);
        if (!stable) {
          return true;
        }
      }
    }

    return false;
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
        const normalize = (value) => (value || '')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/\\s+/g, ' ')
          .replace(/Desplegar/gi, '')
          .trim()
          .toLowerCase();
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

  private async clickSingleSelectorDropdownOption(
    client: CdpClient,
    selector: string,
    option: string
  ): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => (value || '')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/\\s+/g, ' ')
          .replace(/Desplegar/gi, '')
          .trim()
          .toLowerCase();

        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return false;
        }

        const target = normalize(${JSON.stringify(option)});

        const hiddenInput = root.querySelector('input[type="hidden"]');
        const hiddenValue = hiddenInput && typeof hiddenInput.value === 'string'
          ? hiddenInput.value.trim()
          : '';
        if (hiddenValue.length > 0) {
          const selectedNode = root.querySelector(
            'ul.dropdown-list > li[data-value="' + hiddenValue.replace(/"/g, '\\"') + '"], ul.dropdown > li[data-value="' + hiddenValue.replace(/"/g, '\\"') + '"]'
          );
          const selectedText = normalize(selectedNode ? selectedNode.textContent : '');
          if (selectedText === target) {
            return false;
          }
        }

        const selectedPlaceholder = normalize(
          root.querySelector('button.dropdown-wrapper > span.placeholder, :scope > button.dropdown-wrapper > span.placeholder')?.textContent || ''
        );
        if (selectedPlaceholder === target) {
          return false;
        }

        const button = root.querySelector('button.dropdown-wrapper');
        if (button) {
          button.click();
        }

        const options = Array.from(
          root.querySelectorAll('ul.dropdown-list > li, ul.dropdown > li')
        );

        for (const item of options) {
          const text = normalize(item.textContent);
          if (text !== target) {
            continue;
          }
          const clickable = item.querySelector('a') || item;
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

  private normalizeComparableText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/Desplegar/gi, '')
      .trim()
      .toLowerCase();
  }
}
