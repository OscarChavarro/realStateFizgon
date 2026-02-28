import { Injectable, Logger } from '@nestjs/common';
import { FilterLoaderDetectionService } from './filter-loader-detection.service';
import { Filter } from './filter.interface';
import { FilterType } from '../../../model/filters/filter-type.enum';
import { SupportedFilters } from './supported-filters';
import { FilterTextNormalizationService } from './filter-text-normalization.service';
import { FilterSelectionReaderService } from './filter-selection-reader.service';
import { FilterActionExecutorService } from './filter-action-executor.service';
import { CdpClient, MinMaxSelection } from './filter-cdp-client.types';

@Injectable()
export class FilterUpdateService {
  private readonly logger = new Logger(FilterUpdateService.name);
  private readonly maxReconciliationAttempts = 4;
  private readonly maxFullReconciliationPasses = 4;

  constructor(
    private readonly filterLoaderDetectionService: FilterLoaderDetectionService,
    private readonly filterTextNormalizationService: FilterTextNormalizationService,
    private readonly filterSelectionReaderService: FilterSelectionReaderService,
    private readonly filterActionExecutorService: FilterActionExecutorService
  ) {}

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
        const currentSelection = await this.filterSelectionReaderService.readCurrentMinMaxSelection(client, expectedFilter.getCssSelector());
        const hasDiff = this.hasMinMaxDiff(expectedFilter, currentSelection);

        if (!hasDiff) {
          return false;
        }

        const shouldRestart = await this.applyMinMaxActions(client, expectedFilter, currentSelection);
        if (shouldRestart) {
          return true;
        }
      } else {
        const currentSelection = await this.filterSelectionReaderService.readCurrentPlainSelection(client, expectedFilter);
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
    const expectedNormalizedSet = new Set(
      expected.map((option) => this.filterTextNormalizationService.normalizeComparableText(option))
    );
    const currentNormalizedSet = new Set(
      current.map((option) => this.filterTextNormalizationService.normalizeComparableText(option))
    );

    const toEnable = expected.filter(
      (option) => !currentNormalizedSet.has(this.filterTextNormalizationService.normalizeComparableText(option))
    );
    const toDisable = current.filter(
      (option) => !expectedNormalizedSet.has(this.filterTextNormalizationService.normalizeComparableText(option))
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
        const clicked = await this.filterActionExecutorService.clickSingleSelectorDropdownOption(
          client,
          expectedFilter.getCssSelector(),
          option
        );
        if (clicked && await this.shouldRestartAfterClick(client)) {
          return true;
        }
      }

      return false;
    }

    for (const option of toEnable) {
      const clicked = await this.filterActionExecutorService.clickPlainOption(
        client,
        expectedFilter.getCssSelector(),
        option,
        'enable'
      );
      if (clicked && await this.shouldRestartAfterClick(client)) {
        return true;
      }
    }

    for (const option of toDisable) {
      const clicked = await this.filterActionExecutorService.clickPlainOption(
        client,
        expectedFilter.getCssSelector(),
        option,
        'disable'
      );
      if (clicked && await this.shouldRestartAfterClick(client)) {
        return true;
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
      const clicked = await this.filterActionExecutorService.clickMinMaxOption(
        client,
        expectedFilter.getCssSelector(),
        'min',
        value
      );
      if (clicked && await this.shouldRestartAfterClick(client)) {
        return true;
      }
    }

    if (expectedMax !== currentSelection.selectedMax) {
      const value = expectedMax ?? 'Máx';
      const clicked = await this.filterActionExecutorService.clickMinMaxOption(
        client,
        expectedFilter.getCssSelector(),
        'max',
        value
      );
      if (clicked && await this.shouldRestartAfterClick(client)) {
        return true;
      }
    }

    return false;
  }

  private async shouldRestartAfterClick(client: CdpClient): Promise<boolean> {
    await this.filterLoaderDetectionService.scrollToTop(client);
    const stable = await this.filterLoaderDetectionService.waitForPostClickStabilityOrReload(client);
    return !stable;
  }
}
