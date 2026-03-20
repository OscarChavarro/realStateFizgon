import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { FilterActionExecutorService } from 'src/application/services/scraper/filters/filter-action-executor.service';
import { FilterLoaderDetectionService } from 'src/application/services/scraper/filters/filter-loader-detection.service';
import { FilterSelectionReaderService } from 'src/application/services/scraper/filters/filter-selection-reader.service';
import { FilterTextNormalizationService } from 'src/application/services/scraper/filters/filter-text-normalization.service';
import { FilterUpdateService } from 'src/application/services/scraper/filters/filter-update.service';
import { SupportedFilters } from 'src/domain/filters/supported-filters';
import { Price } from 'src/domain/filters/price.filter';
import { PropertyType } from 'src/domain/filters/property-type.filter';
import { Rooms } from 'src/domain/filters/rooms.filter';

class FilterLoaderDetectionServiceMock {
  readonly scrollToTop = jest.fn<(client: CdpClient) => Promise<void>>();
  readonly waitForPostClickStabilityOrReload = jest.fn<(client: CdpClient) => Promise<boolean>>();
}

class FilterSelectionReaderServiceMock {
  readonly readCurrentPlainSelection = jest.fn<(client: CdpClient, filter: unknown) => Promise<string[]>>();
  readonly readCurrentMinMaxSelection = jest.fn<(client: CdpClient, selector: string) => Promise<{ selectedMin: string | null; selectedMax: string | null }>>();
}

class FilterActionExecutorServiceMock {
  readonly clickPlainOption = jest.fn<(client: CdpClient, selector: string, option: string, mode: 'enable' | 'disable') => Promise<boolean>>();
  readonly clickSingleSelectorDropdownOption = jest.fn<(client: CdpClient, selector: string, option: string) => Promise<boolean>>();
  readonly clickMinMaxOption = jest.fn<(client: CdpClient, selector: string, role: 'min' | 'max', value: string) => Promise<boolean>>();
}

function createClient(): CdpClient {
  return {
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    Page: {
      reload: jest.fn(async () => undefined),
      loadEventFired: jest.fn()
    }
  };
}

function wrapFilters(filters: unknown[]): SupportedFilters {
  return { getSupportedFilters: () => filters as never[] } as unknown as SupportedFilters;
}

describe('FilterUpdateService', () => {
  it('whenSelectionsAlreadyMatch_applyRequiredActions_shouldFinishWithoutClicks', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue(['2 habitaciones']);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Rooms();
    expected.setSelectedPlainOptions(['2 habitaciones']);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickPlainOption).not.toHaveBeenCalled();
    expect(loader.waitForPostClickStabilityOrReload).not.toHaveBeenCalled();
  });

  it('whenPlainFilterNeedsChanges_applyRequiredActions_shouldEnableAndDisableOptions', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue(['A']);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickPlainOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Rooms();
    expected.setSelectedPlainOptions(['B']);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickPlainOption).toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'B', 'enable');
    expect(actionExecutor.clickPlainOption).toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'A', 'disable');
    expect(loader.waitForPostClickStabilityOrReload).toHaveBeenCalled();
  });

  it('whenDropdownFilterNeedsChange_applyRequiredActions_shouldUseDropdownClickAction', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickSingleSelectorDropdownOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new PropertyType();
    expected.setSelectedPlainOptions(['Piso']);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickSingleSelectorDropdownOption).toHaveBeenCalledWith(
      expect.any(Object),
      expected.getCssSelector(),
      'Piso'
    );
    expect(actionExecutor.clickPlainOption).not.toHaveBeenCalled();
  });

  it('whenMinMaxFilterNeedsChanges_applyRequiredActions_shouldApplyMinAndMaxClicks', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: '100', selectedMax: '500' });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickMinMaxOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Price();
    expected.setSelectedMin(null);
    expected.setSelectedMax('800');
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'min', 'Mín');
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'max', '800');
  });

  it('whenExpectedMaxIsNullAndCurrentMaxIsSelected_applyRequiredActions_shouldUseMaxPlaceholderFallback', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection
      .mockResolvedValueOnce({ selectedMin: null, selectedMax: '1200' })
      .mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickMinMaxOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Price();
    expected.setSelectedMin(null);
    expected.setSelectedMax(null);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'max', 'Máx');
  });

  it('whenOnlyMinChangesAndFlowStaysStable_applyRequiredActions_shouldSkipMaxUpdateBranch', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: '100', selectedMax: '800' });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickMinMaxOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Price();
    expected.setSelectedMin('200');
    expected.setSelectedMax('800');
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'min', '200');
    expect(actionExecutor.clickMinMaxOption).not.toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'max', '800');
  });

  it('whenPostClickReloadHappens_applyRequiredActions_shouldRestartFromBeginningAndReconcileAgain', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['B']);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickPlainOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Rooms();
    expected.setSelectedPlainOptions(['B']);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(selectionReader.readCurrentPlainSelection).toHaveBeenCalledTimes(2);
    expect(loader.waitForPostClickStabilityOrReload).toHaveBeenCalledTimes(1);
  });

  it('whenReconciliationKeepsRestarting_applyRequiredActions_shouldStopAfterMaximumPasses', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(false);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickSingleSelectorDropdownOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const logger = {
      log: jest.fn<(message: string) => void>(),
      warn: jest.fn<(message: string) => void>(),
      error: jest.fn<(message: string) => void>()
    };
    (service as unknown as { logger: typeof logger }).logger = logger;
    const expected = new PropertyType();
    expected.setSelectedPlainOptions(['Piso']);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(loader.waitForPostClickStabilityOrReload).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalledWith('Reached maximum full reconciliation passes.');
  });

  it('whenMinMaxSelectionAlreadyMatches_applyRequiredActions_shouldSkipMinMaxClicks', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: '200', selectedMax: '900' });
    const actionExecutor = new FilterActionExecutorServiceMock();
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Price();
    expected.setSelectedMin('200');
    expected.setSelectedMax('900');
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickMinMaxOption).not.toHaveBeenCalled();
    expect(loader.waitForPostClickStabilityOrReload).not.toHaveBeenCalled();
  });

  it('whenPlainFilterOnlyNeedsDisabling_applyRequiredActions_shouldRestartAfterDisableClick', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(false);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue(['Sobrante']);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickPlainOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Rooms();
    expected.setSelectedPlainOptions([]);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickPlainOption).toHaveBeenCalledWith(expect.any(Object), expected.getCssSelector(), 'Sobrante', 'disable');
    expect(loader.waitForPostClickStabilityOrReload).toHaveBeenCalled();
  });

  it.each([
    {
      currentSelection: { selectedMin: '100', selectedMax: '800' },
      expectedSelection: { selectedMin: '200', selectedMax: '800' }
    },
    {
      currentSelection: { selectedMin: '200', selectedMax: '700' },
      expectedSelection: { selectedMin: '200', selectedMax: '800' }
    }
  ])('whenMinMaxNeedsSingleSideUpdate_applyRequiredActions_shouldRestartAfterClickedBound', async ({
    currentSelection,
    expectedSelection
  }) => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(false);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue(currentSelection);
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickMinMaxOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = new Price();
    expected.setSelectedMin(expectedSelection.selectedMin);
    expected.setSelectedMax(expectedSelection.selectedMax);
    // Action
    await service.applyRequiredActions(createClient(), wrapFilters([expected]), wrapFilters([]));
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledTimes(4);
    expect(loader.waitForPostClickStabilityOrReload).toHaveBeenCalled();
  });
});
