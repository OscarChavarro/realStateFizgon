import { Injectable, Logger } from '@nestjs/common';
import { FilterLoaderDetectionService } from 'application/services/scraper/filters/filter-loader-detection.service';
import { FilterSnapshot } from 'application/services/scraper/filters/filter-snapshot.type';
import { FilterType } from 'domain/filters/filter-type';
import { FilterTextNormalizationService } from 'application/services/scraper/filters/filter-text-normalization.service';
import { FilterSelectionReaderService } from 'application/services/scraper/filters/filter-selection-reader.service';
import { FilterActionExecutorService } from 'application/services/scraper/filters/filter-action-executor.service';
import { MinMaxSelection } from 'application/dto/scraper/min-max-selection.dto';

import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
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
    client: FiltersCdpClient,
    preloadedFiltersFromConfiguration: readonly FilterSnapshot[],
    extractedFiltersFromDom: readonly FilterSnapshot[]
  ): Promise<void> {
    const preloaded = preloadedFiltersFromConfiguration;
    const extractedCount = extractedFiltersFromDom.length;
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

  private async reconcileFilter(client: FiltersCdpClient, expectedFilter: FilterSnapshot): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxReconciliationAttempts; attempt += 1) {
      if (expectedFilter.type === FilterType.MIN_MAX) {
        const currentSelection = await this.filterSelectionReaderService.readCurrentMinMaxSelection(client, expectedFilter.cssSelector);
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
          [...expectedFilter.selectedPlainOptions],
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

    this.logger.warn(`Could not fully reconcile filter ${expectedFilter.name} after retries.`);
    return false;
  }

  private hasMinMaxDiff(expectedFilter: FilterSnapshot, currentSelection: MinMaxSelection): boolean {
    return expectedFilter.selectedMin !== currentSelection.selectedMin
      || expectedFilter.selectedMax !== currentSelection.selectedMax;
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
    client: FiltersCdpClient,
    expectedFilter: FilterSnapshot,
    toEnable: string[],
    toDisable: string[]
  ): Promise<boolean> {
    if (expectedFilter.type === FilterType.SINGLE_SELECTOR_DROPDOWN) {
      for (const option of toEnable) {
        const clicked = await this.filterActionExecutorService.clickSingleSelectorDropdownOption(
          client,
          expectedFilter.cssSelector,
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
        expectedFilter.cssSelector,
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
        expectedFilter.cssSelector,
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
    client: FiltersCdpClient,
    expectedFilter: FilterSnapshot,
    currentSelection: MinMaxSelection
  ): Promise<boolean> {
    const expectedMin = expectedFilter.selectedMin;
    const expectedMax = expectedFilter.selectedMax;

    if (expectedMin !== currentSelection.selectedMin) {
      const value = expectedMin ?? 'Mín';
      const clicked = await this.filterActionExecutorService.clickMinMaxOption(
        client,
        expectedFilter.cssSelector,
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
        expectedFilter.cssSelector,
        'max',
        value
      );
      if (clicked && await this.shouldRestartAfterClick(client)) {
        return true;
      }
    }

    return false;
  }

  private async shouldRestartAfterClick(client: FiltersCdpClient): Promise<boolean> {
    await this.filterLoaderDetectionService.scrollToTop(client);
    const stable = await this.filterLoaderDetectionService.waitForPostClickStabilityOrReload(client);
    return !stable;
  }
}
