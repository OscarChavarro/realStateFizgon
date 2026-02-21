import { Injectable, Logger } from '@nestjs/common';
import { FilterUpdateService } from './filter-update.service';
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

type RuntimeDomain = {
  enable(): Promise<void>;
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
};

type CdpClient = {
  Runtime: RuntimeDomain;
  Page: {
    reload(params?: { ignoreCache?: boolean }): Promise<void>;
    loadEventFired(cb: () => void): void;
  };
};

type AsideSection = {
  index: number;
  name: string;
  normalized: string;
};

type AsideFiltersPayload = {
  found: boolean;
  sections: AsideSection[];
};

type MinMaxOptions = {
  minOptions: string[];
  maxOptions: string[];
};

type MinMaxSelection = {
  selectedMin: string | null;
  selectedMax: string | null;
};

@Injectable()
export class FiltersService {
  private readonly logger = new Logger(FiltersService.name);
  private readonly extractedFiltersFromDom = new SupportedFilters();
  private readonly preloadedFiltersFromConfiguration = new SupportedFilters().loadFromConfiguration();

  constructor(private readonly filterUpdateService: FilterUpdateService) {}

  async execute(client: CdpClient): Promise<void> {
    await client.Runtime.enable();
    const payload = await this.readAsideFilters(client);

    if (!payload.found) {
      this.logger.warn('Filters root #aside-filters was not found on the page.');
      return;
    }

    const matchedSectionIndexes = new Set<number>();

    for (const filter of this.extractedFiltersFromDom.getSupportedFilters()) {
      await this.processFilter(client, payload, filter, matchedSectionIndexes);
    }

    await this.filterUpdateService.applyRequiredActions(
      client,
      this.preloadedFiltersFromConfiguration,
      this.extractedFiltersFromDom
    );

    const unsupported = payload.sections.filter((section) => !matchedSectionIndexes.has(section.index));
    for (const section of unsupported) {
      this.logger.log(`Not supported: ${section.name}`);
    }
  }

  private async processFilter(
    client: CdpClient,
    payload: AsideFiltersPayload,
    filter: Filter,
    matchedSectionIndexes: Set<number>
  ): Promise<void> {
    const presentBySelector = await this.isPresentBySelector(client, filter.getCssSelector());
    const supportedNormalized = this.normalizeText(filter.getName());
    const matched = payload.sections.find((section) => this.matches(section.normalized, supportedNormalized));

    if (matched) {
      matchedSectionIndexes.add(matched.index);
    }

    const present = presentBySelector || Boolean(matched);
    this.logger.log(`Filter: ${filter.getName()} | Present: ${present ? 'yes' : 'no'}`);

    if (!present) {
      return;
    }

    switch (filter.getType()) {
      case FilterType.MIN_MAX:
        await this.processMinMaxFilter(client, filter);
        return;
      case FilterType.SINGLE_SELECTOR_DROPDOWN:
        await this.processSingleSelectorDropdownFilter(client, filter);
        return;
      case FilterType.MULTIPLE_SELECTOR:
        await this.processMultipleSelectorFilter(client, filter);
        return;
      case FilterType.SINGLE_SELECTOR:
        await this.processSingleSelectorFilter(client, filter);
        return;
      default:
        filter.setPlainOptions([]);
    }
  }

  private async processMinMaxFilter(client: CdpClient, filter: Filter): Promise<void> {
    const { minOptions, maxOptions } = await this.extractMinMaxOptions(client, filter.getCssSelector());
    const { selectedMin, selectedMax } = await this.extractSelectedMinMax(client, filter.getCssSelector());
    filter.setMinOptions(minOptions);
    filter.setMaxOptions(maxOptions);
    filter.setSelectedMin(selectedMin);
    filter.setSelectedMax(selectedMax);
  }

  private async processSingleSelectorDropdownFilter(client: CdpClient, filter: Filter): Promise<void> {
    const options = await this.extractSingleSelectorDropdownOptions(client, filter.getCssSelector());
    const selectedPlainOptions = await this.extractSelectedSingleSelectorDropdownOptions(client, filter.getCssSelector());
    filter.setPlainOptions(options);
    filter.setSelectedPlainOptions(selectedPlainOptions);
  }

  private async processMultipleSelectorFilter(client: CdpClient, filter: Filter): Promise<void> {
    const options = await this.extractMultipleSelectorOptions(client, filter.getCssSelector());
    const selectedPlainOptions = await this.extractSelectedMultipleSelectorOptions(client, filter.getCssSelector());
    filter.setPlainOptions(options);
    filter.setSelectedPlainOptions(selectedPlainOptions);
  }

  private async processSingleSelectorFilter(client: CdpClient, filter: Filter): Promise<void> {
    const options = await this.extractSingleSelectorOptions(client, filter.getCssSelector());
    const selectedPlainOptions = await this.extractSelectedSingleSelectorOptions(client, filter.getCssSelector());
    filter.setPlainOptions(options);
    filter.setSelectedPlainOptions(selectedPlainOptions);
  }

  private async extractSingleSelectorDropdownOptions(client: CdpClient, selector: string): Promise<string[]> {
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

  private async extractMultipleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
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

  private async extractSingleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
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

  private async extractSelectedMultipleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
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

  private async extractSelectedSingleSelectorOptions(client: CdpClient, selector: string): Promise<string[]> {
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

  private async extractMinMaxOptions(client: CdpClient, selector: string): Promise<MinMaxOptions> {
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

  private async extractSelectedMinMax(client: CdpClient, selector: string): Promise<MinMaxSelection> {
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

  private async readAsideFilters(client: CdpClient): Promise<AsideFiltersPayload> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => value
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .toLowerCase()
          .replace(/\\s+/g, ' ')
          .trim();

        const getName = (element) => {
          const heading = element.matches('legend, h1, h2, h3, h4')
            ? element
            : element.querySelector(':scope > legend, :scope > .title-label, :scope > span.title-label, legend, .title-label, h1, h2, h3, h4');
          const source = heading || element;
          const text = (source.textContent || '').replace(/\\s+/g, ' ').trim();
          return text.length > 140 ? text.slice(0, 140) : text;
        };

        const root = document.querySelector('#aside-filters');
        if (!root) {
          return { found: false, sections: [] };
        }

        const formRoot = root.querySelector(':scope > #filter-form') || root.querySelector('#filter-form');
        const container = formRoot || root;

        const sections = Array.from(container.children)
          .map((child, index) => {
            const element = child;
            const hasHeading = Boolean(
              element.matches('fieldset.item-form, div.item-form') ||
              element.querySelector(':scope > legend, :scope > .title-label, :scope > span.title-label')
            );
            if (!hasHeading) {
              return null;
            }
            const name = getName(child);
            return {
              index,
              name,
              normalized: normalize(name)
            };
          })
          .filter((section) => section !== null)
          .filter((section) => section.name.length > 0);

        return {
          found: true,
          sections
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    const payload = result.result?.value as AsideFiltersPayload | undefined;
    if (!payload) {
      return { found: false, sections: [] };
    }

    return payload;
  }

  private matches(sectionName: string, supportedName: string): boolean {
    return sectionName.includes(supportedName) || supportedName.includes(sectionName);
  }

  private async isPresentBySelector(client: CdpClient, selector: string): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      returnByValue: true
    });

    return result.result?.value === true;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
