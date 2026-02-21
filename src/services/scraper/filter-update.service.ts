import { Injectable, Logger } from '@nestjs/common';
import { Filter } from './filters/filter.interface';
import { FilterType } from './filters/filter-type.enum';
import { SupportedFilters } from './filters/supported-filters';

@Injectable()
export class FilterUpdateService {
  private readonly logger = new Logger(FilterUpdateService.name);

  logRequiredActions(
    preloadedFiltersFromConfiguration: SupportedFilters,
    extractedFiltersFromDom: SupportedFilters
  ): void {
    const preloaded = preloadedFiltersFromConfiguration.getSupportedFilters();
    const extractedMap = new Map<string, Filter>(
      extractedFiltersFromDom.getSupportedFilters().map((filter) => [filter.getName(), filter])
    );

    for (const expectedFilter of preloaded) {
      const actualFilter = extractedMap.get(expectedFilter.getName());
      if (!actualFilter) {
        continue;
      }

      if (expectedFilter.getType() === FilterType.MIN_MAX) {
        this.logMinMaxActions(expectedFilter, actualFilter);
        continue;
      }

      this.logPlainSelectionActions(expectedFilter, actualFilter);
    }
  }

  private logPlainSelectionActions(expectedFilter: Filter, actualFilter: Filter): void {
    const expectedSelected = new Set(expectedFilter.getSelectedPlainOptions());
    const actualSelected = new Set(actualFilter.getSelectedPlainOptions());

    for (const option of expectedSelected) {
      if (!actualSelected.has(option)) {
        this.logger.log(`Click on ${option} to enable it`);
      }
    }

    for (const option of actualSelected) {
      if (!expectedSelected.has(option)) {
        this.logger.log(`Click on ${option} to disable it`);
      }
    }
  }

  private logMinMaxActions(expectedFilter: Filter, actualFilter: Filter): void {
    const expectedMin = expectedFilter.getSelectedMin();
    const expectedMax = expectedFilter.getSelectedMax();
    const actualMin = actualFilter.getSelectedMin();
    const actualMax = actualFilter.getSelectedMax();

    if (expectedMin !== actualMin) {
      if (expectedMin === null) {
        this.logger.log(`Clear minimum value on ${expectedFilter.getName()}`);
      } else {
        this.logger.log(`Set minimum value on ${expectedFilter.getName()} to ${expectedMin}`);
      }
    }

    if (expectedMax !== actualMax) {
      if (expectedMax === null) {
        this.logger.log(`Clear maximum value on ${expectedFilter.getName()}`);
      } else {
        this.logger.log(`Set maximum value on ${expectedFilter.getName()} to ${expectedMax}`);
      }
    }
  }
}
