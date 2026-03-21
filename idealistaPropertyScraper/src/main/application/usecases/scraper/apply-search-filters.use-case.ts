import { Inject, Injectable, Logger } from '@nestjs/common';
import { FilterSnapshot } from 'application/services/scraper/filters/filter-snapshot.type';
import { FilterAvailableOptionExtractorService } from 'application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterSelectedOptionExtractorService } from 'application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterUpdateService } from 'application/services/scraper/filters/filter-update.service';
import { SupportedFilters } from 'domain/filters/supported-filters';
import { FilterType } from 'domain/filters/filter-type';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';
import type { FilterId } from 'domain/filters/filter-id';

import type { AsideFiltersPayload } from 'application/dto/scraper/aside-filters-payload.dto';
import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
@Injectable()
export class ApplySearchFiltersUseCase {
  private readonly logger = new Logger(ApplySearchFiltersUseCase.name);

  constructor(
    private readonly filterUpdateService: FilterUpdateService,
    private readonly filterAvailableOptionExtractor: FilterAvailableOptionExtractorService,
    private readonly filterSelectedOptionExtractor: FilterSelectedOptionExtractorService,
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort
  ) {}

  async execute(client: FiltersCdpClient): Promise<void> {
    await client.Runtime.enable();
    const payload = await this.readAsideFilters(client);

    if (!payload.found) {
      this.logger.warn('Filters root #aside-filters was not found on the page.');
      return;
    }

    const baseFilterSnapshots = this.buildBaseFilterSnapshots();
    const preloadedFiltersFromConfiguration = this.buildConfiguredFilterSnapshots(baseFilterSnapshots);
    const matchedSectionIndexes = new Set<number>();
    const extractedFiltersFromDom: FilterSnapshot[] = [];

    for (const filterSnapshot of baseFilterSnapshots) {
      const extractedSnapshot = await this.processFilter(client, payload, filterSnapshot, matchedSectionIndexes);
      if (extractedSnapshot) {
        extractedFiltersFromDom.push(extractedSnapshot);
      }
    }
    const extractedFilterSnapshots = Object.freeze([...extractedFiltersFromDom]) as readonly FilterSnapshot[];

    await this.filterUpdateService.applyRequiredActions(
      client,
      preloadedFiltersFromConfiguration,
      extractedFilterSnapshots
    );

    const unsupported = payload.sections.filter((section) => !matchedSectionIndexes.has(section.index));
    for (const section of unsupported) {
      this.logger.log(`Not supported: ${section.name}`);
    }
  }

  private async processFilter(
    client: FiltersCdpClient,
    payload: AsideFiltersPayload,
    filter: FilterSnapshot,
    matchedSectionIndexes: Set<number>
  ): Promise<FilterSnapshot | null> {
    const presentBySelector = await this.isPresentBySelector(client, filter.cssSelector);
    const supportedNormalized = this.normalizeText(filter.name);
    const matched = payload.sections.find((section) => this.matches(section.normalized, supportedNormalized));

    if (matched) {
      matchedSectionIndexes.add(matched.index);
    }

    const present = presentBySelector || Boolean(matched);

    if (!present) {
      return null;
    }

    switch (filter.type) {
      case FilterType.MIN_MAX:
        return this.processMinMaxFilter(client, filter);
      case FilterType.SINGLE_SELECTOR_DROPDOWN:
        return this.processSingleSelectorDropdownFilter(client, filter);
      case FilterType.MULTIPLE_SELECTOR:
        return this.processMultipleSelectorFilter(client, filter);
      case FilterType.SINGLE_SELECTOR:
        return this.processSingleSelectorFilter(client, filter);
      default:
        return this.createFilterSnapshot({
          ...filter,
          plainOptions: [],
          selectedPlainOptions: []
        });
    }
  }

  private async processMinMaxFilter(client: FiltersCdpClient, filter: FilterSnapshot): Promise<FilterSnapshot> {
    const { minOptions, maxOptions } = await this.filterAvailableOptionExtractor.extractMinMaxOptions(client, filter.cssSelector);
    const { selectedMin, selectedMax } = await this.filterSelectedOptionExtractor.extractSelectedMinMax(client, filter.cssSelector);
    return this.createFilterSnapshot({
      ...filter,
      minOptions,
      maxOptions,
      selectedMin,
      selectedMax
    });
  }

  private async processSingleSelectorDropdownFilter(client: FiltersCdpClient, filter: FilterSnapshot): Promise<FilterSnapshot> {
    const options = await this.filterAvailableOptionExtractor.extractSingleSelectorDropdownOptions(client, filter.cssSelector);
    const selectedPlainOptions = await this.filterSelectedOptionExtractor.extractSelectedSingleSelectorDropdownOptions(client, filter.cssSelector);
    return this.createFilterSnapshot({
      ...filter,
      plainOptions: options,
      selectedPlainOptions
    });
  }

  private async processMultipleSelectorFilter(client: FiltersCdpClient, filter: FilterSnapshot): Promise<FilterSnapshot> {
    const options = await this.filterAvailableOptionExtractor.extractMultipleSelectorOptions(client, filter.cssSelector);
    const selectedPlainOptions = await this.filterSelectedOptionExtractor.extractSelectedMultipleSelectorOptions(client, filter.cssSelector);
    return this.createFilterSnapshot({
      ...filter,
      plainOptions: options,
      selectedPlainOptions
    });
  }

  private async processSingleSelectorFilter(client: FiltersCdpClient, filter: FilterSnapshot): Promise<FilterSnapshot> {
    const options = await this.filterAvailableOptionExtractor.extractSingleSelectorOptions(client, filter.cssSelector);
    const selectedPlainOptions = await this.filterSelectedOptionExtractor.extractSelectedSingleSelectorOptions(client, filter.cssSelector);
    return this.createFilterSnapshot({
      ...filter,
      plainOptions: options,
      selectedPlainOptions
    });
  }

  private async readAsideFilters(client: FiltersCdpClient): Promise<AsideFiltersPayload> {
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

  private async isPresentBySelector(client: FiltersCdpClient, selector: string): Promise<boolean> {
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

  private buildBaseFilterSnapshots(): readonly FilterSnapshot[] {
    const supportedFilters = new SupportedFilters().getSupportedFilters();
    return Object.freeze(
      supportedFilters.map((filter) =>
        this.createFilterSnapshot({
          id: filter.getId(),
          name: filter.getName(),
          cssSelector: filter.getCssSelector(),
          type: filter.getType(),
          plainOptions: [],
          selectedPlainOptions: [],
          minOptions: [],
          maxOptions: [],
          selectedMin: null,
          selectedMax: null
        })
      )
    ) as readonly FilterSnapshot[];
  }

  private buildConfiguredFilterSnapshots(baseSnapshots: readonly FilterSnapshot[]): readonly FilterSnapshot[] {
    return Object.freeze(
      baseSnapshots.map((filter) => {
        const definition = this.scraperConfig.getFilterDefinitionById(filter.id);
        if (!definition) {
          return filter;
        }

        if (filter.type === FilterType.MIN_MAX) {
          return this.createFilterSnapshot({
            ...filter,
            minOptions: definition.minOptions,
            maxOptions: definition.maxOptions,
            selectedMin: definition.selectedMin,
            selectedMax: definition.selectedMax
          });
        }

        return this.createFilterSnapshot({
          ...filter,
          plainOptions: definition.plainOptions,
          selectedPlainOptions: definition.selectedPlainOptions
        });
      })
    ) as readonly FilterSnapshot[];
  }

  private createFilterSnapshot(data: {
    id: FilterId;
    name: string;
    cssSelector: string;
    type: FilterType;
    plainOptions: readonly string[];
    selectedPlainOptions: readonly string[];
    minOptions: readonly string[];
    maxOptions: readonly string[];
    selectedMin: string | null;
    selectedMax: string | null;
  }): FilterSnapshot {
    return Object.freeze({
      id: data.id,
      name: data.name,
      cssSelector: data.cssSelector,
      type: data.type,
      plainOptions: Object.freeze([...data.plainOptions]),
      selectedPlainOptions: Object.freeze([...data.selectedPlainOptions]),
      minOptions: Object.freeze([...data.minOptions]),
      maxOptions: Object.freeze([...data.maxOptions]),
      selectedMin: data.selectedMin,
      selectedMax: data.selectedMax
    });
  }
}
