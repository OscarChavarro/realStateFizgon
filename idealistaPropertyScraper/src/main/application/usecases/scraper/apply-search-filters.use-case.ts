import { Inject, Injectable, Logger  } from '@nestjs/common';
import { FilterAvailableOptionExtractorService } from 'application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterSelectedOptionExtractorService } from 'application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterUpdateService } from 'application/services/scraper/filters/filter-update.service';
import { SupportedFilters } from 'domain/filters/supported-filters';
import { Filter } from 'domain/filters/filter';
import { FilterType } from 'domain/filters/filter-type.enum';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';

import type { AsideFiltersPayload } from 'application/dto/scraper/aside-filters-payload.dto';
import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
@Injectable()
export class ApplySearchFiltersUseCase {
  private readonly logger = new Logger(ApplySearchFiltersUseCase.name);
  private readonly extractedFiltersFromDom = new SupportedFilters();
  private readonly preloadedFiltersFromConfiguration = new SupportedFilters();

  constructor(
    private readonly filterUpdateService: FilterUpdateService,
    private readonly filterAvailableOptionExtractor: FilterAvailableOptionExtractorService,
    private readonly filterSelectedOptionExtractor: FilterSelectedOptionExtractorService,
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort
  ) {
    this.applyConfiguredFilterDefinitions();
  }

  async execute(client: FiltersCdpClient): Promise<void> {
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
    client: FiltersCdpClient,
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

  private async processMinMaxFilter(client: FiltersCdpClient, filter: Filter): Promise<void> {
    const { minOptions, maxOptions } = await this.filterAvailableOptionExtractor.extractMinMaxOptions(client, filter.getCssSelector());
    const { selectedMin, selectedMax } = await this.filterSelectedOptionExtractor.extractSelectedMinMax(client, filter.getCssSelector());
    filter.setMinOptions(minOptions);
    filter.setMaxOptions(maxOptions);
    filter.setSelectedMin(selectedMin);
    filter.setSelectedMax(selectedMax);
  }

  private async processSingleSelectorDropdownFilter(client: FiltersCdpClient, filter: Filter): Promise<void> {
    const options = await this.filterAvailableOptionExtractor.extractSingleSelectorDropdownOptions(client, filter.getCssSelector());
    const selectedPlainOptions = await this.filterSelectedOptionExtractor.extractSelectedSingleSelectorDropdownOptions(client, filter.getCssSelector());
    filter.setPlainOptions(options);
    filter.setSelectedPlainOptions(selectedPlainOptions);
  }

  private async processMultipleSelectorFilter(client: FiltersCdpClient, filter: Filter): Promise<void> {
    const options = await this.filterAvailableOptionExtractor.extractMultipleSelectorOptions(client, filter.getCssSelector());
    const selectedPlainOptions = await this.filterSelectedOptionExtractor.extractSelectedMultipleSelectorOptions(client, filter.getCssSelector());
    filter.setPlainOptions(options);
    filter.setSelectedPlainOptions(selectedPlainOptions);
  }

  private async processSingleSelectorFilter(client: FiltersCdpClient, filter: Filter): Promise<void> {
    const options = await this.filterAvailableOptionExtractor.extractSingleSelectorOptions(client, filter.getCssSelector());
    const selectedPlainOptions = await this.filterSelectedOptionExtractor.extractSelectedSingleSelectorOptions(client, filter.getCssSelector());
    filter.setPlainOptions(options);
    filter.setSelectedPlainOptions(selectedPlainOptions);
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

  private applyConfiguredFilterDefinitions(): void {
    for (const filter of this.preloadedFiltersFromConfiguration.getSupportedFilters()) {
      const definition = this.scraperConfig.getFilterDefinitionByName(filter.getName());
      if (!definition) {
        continue;
      }

      if (filter.getType() === FilterType.MIN_MAX) {
        filter.setMinOptions(definition.minOptions);
        filter.setMaxOptions(definition.maxOptions);
        filter.setSelectedMin(definition.selectedMin);
        filter.setSelectedMax(definition.selectedMax);
        continue;
      }

      filter.setPlainOptions(definition.plainOptions);
      filter.setSelectedPlainOptions(definition.selectedPlainOptions);
    }
  }
}
