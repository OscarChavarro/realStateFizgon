import { describe, expect, it, jest } from '@jest/globals';
import { FilterSnapshot } from 'application/services/scraper/filters/filter-snapshot.type';
import { FilterActionExecutorService } from 'application/services/scraper/filters/filter-action-executor.service';
import { FilterLoaderDetectionService } from 'application/services/scraper/filters/filter-loader-detection.service';
import { FilterSelectionReaderService } from 'application/services/scraper/filters/filter-selection-reader.service';
import { FilterTextNormalizationService } from 'application/services/scraper/filters/filter-text-normalization.service';
import { FilterUpdateService } from 'application/services/scraper/filters/filter-update.service';
import { FilterType } from 'domain/filters/filter-type';

import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';

class FilterLoaderDetectionServiceMock {
  readonly scrollToTop = jest.fn<(client: FiltersCdpClient) => Promise<void>>();
  readonly waitForPostClickStabilityOrReload = jest.fn<(client: FiltersCdpClient) => Promise<boolean>>();
}

class FilterSelectionReaderServiceMock {
  readonly readCurrentPlainSelection = jest.fn<(client: FiltersCdpClient, filter: unknown) => Promise<string[]>>();
  readonly readCurrentMinMaxSelection = jest.fn<(client: FiltersCdpClient, selector: string) => Promise<{ selectedMin: string | null; selectedMax: string | null }>>();
}

class FilterActionExecutorServiceMock {
  readonly clickPlainOption = jest.fn<(client: FiltersCdpClient, selector: string, option: string, mode: 'enable' | 'disable') => Promise<boolean>>();
  readonly clickSingleSelectorDropdownOption = jest.fn<(client: FiltersCdpClient, selector: string, option: string) => Promise<boolean>>();
  readonly clickMinMaxOption = jest.fn<(client: FiltersCdpClient, selector: string, role: 'min' | 'max', value: string) => Promise<boolean>>();
}

function createClient(): FiltersCdpClient {
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

function createSnapshot(overrides: Partial<FilterSnapshot> = {}): FilterSnapshot {
  return Object.freeze({
    id: overrides.id ?? 'rooms',
    name: overrides.name ?? 'Habitaciones',
    cssSelector: overrides.cssSelector ?? '#rooms',
    type: overrides.type ?? FilterType.MULTIPLE_SELECTOR,
    plainOptions: Object.freeze([...(overrides.plainOptions ?? [])]),
    selectedPlainOptions: Object.freeze([...(overrides.selectedPlainOptions ?? [])]),
    minOptions: Object.freeze([...(overrides.minOptions ?? [])]),
    maxOptions: Object.freeze([...(overrides.maxOptions ?? [])]),
    selectedMin: overrides.selectedMin ?? null,
    selectedMax: overrides.selectedMax ?? null
  });
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
    const expected = createSnapshot({
      name: 'Habitaciones',
      cssSelector: '#rooms',
      type: FilterType.MULTIPLE_SELECTOR,
      selectedPlainOptions: ['2 habitaciones']
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
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
    const expected = createSnapshot({
      name: 'Habitaciones',
      cssSelector: '#rooms',
      type: FilterType.MULTIPLE_SELECTOR,
      selectedPlainOptions: ['B']
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickPlainOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'B', 'enable');
    expect(actionExecutor.clickPlainOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'A', 'disable');
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
    const expected = createSnapshot({
      name: 'Tipo de inmueble',
      cssSelector: '#typology',
      type: FilterType.SINGLE_SELECTOR_DROPDOWN,
      selectedPlainOptions: ['Piso']
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickSingleSelectorDropdownOption).toHaveBeenCalledWith(
      expect.any(Object),
      expected.cssSelector,
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
    const expected = createSnapshot({
      name: 'Precio',
      cssSelector: '#price',
      type: FilterType.MIN_MAX,
      selectedMin: null,
      selectedMax: '800'
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'min', 'Mín');
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'max', '800');
  });

  it('whenOnlyMinDiffExists_applyRequiredActions_shouldSkipMaxClickBranch', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload.mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection
      .mockResolvedValueOnce({ selectedMin: '100', selectedMax: '500' })
      .mockResolvedValue({ selectedMin: '200', selectedMax: '500' });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickMinMaxOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = createSnapshot({
      name: 'Precio',
      cssSelector: '#price',
      type: FilterType.MIN_MAX,
      selectedMin: '200',
      selectedMax: '500'
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledTimes(1);
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'min', '200');
    expect(actionExecutor.clickMinMaxOption).not.toHaveBeenCalledWith(
      expect.any(Object),
      expected.cssSelector,
      'max',
      expect.any(String)
    );
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
    const expected = createSnapshot({
      name: 'Precio',
      cssSelector: '#price',
      type: FilterType.MIN_MAX,
      selectedMin: null,
      selectedMax: null
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'max', 'Máx');
  });

  it('whenDisablingPlainOptionTriggersReload_applyRequiredActions_shouldRestartAndReconcileAgain', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection
      .mockResolvedValueOnce(['A'])
      .mockResolvedValueOnce([]);
    selectionReader.readCurrentMinMaxSelection.mockResolvedValue({ selectedMin: null, selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickPlainOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = createSnapshot({
      name: 'Habitaciones',
      cssSelector: '#rooms',
      type: FilterType.MULTIPLE_SELECTOR,
      selectedPlainOptions: []
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickPlainOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'A', 'disable');
    expect(selectionReader.readCurrentPlainSelection).toHaveBeenCalledTimes(2);
    expect(loader.waitForPostClickStabilityOrReload).toHaveBeenCalledTimes(1);
  });

  it('whenMinSelectionClickTriggersReload_applyRequiredActions_shouldRestartDuringMinMaxReconciliation', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection
      .mockResolvedValueOnce({ selectedMin: '300', selectedMax: '1000' })
      .mockResolvedValueOnce({ selectedMin: null, selectedMax: '1000' });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickMinMaxOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = createSnapshot({
      name: 'Precio',
      cssSelector: '#price',
      type: FilterType.MIN_MAX,
      selectedMin: null,
      selectedMax: '1000'
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'min', 'Mín');
    expect(selectionReader.readCurrentMinMaxSelection).toHaveBeenCalledTimes(2);
  });

  it('whenMaxSelectionClickTriggersReload_applyRequiredActions_shouldRestartDuringMaxBranch', async () => {
    // Arrange
    const loader = new FilterLoaderDetectionServiceMock();
    loader.scrollToTop.mockResolvedValue(undefined);
    loader.waitForPostClickStabilityOrReload
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const selectionReader = new FilterSelectionReaderServiceMock();
    selectionReader.readCurrentPlainSelection.mockResolvedValue([]);
    selectionReader.readCurrentMinMaxSelection
      .mockResolvedValueOnce({ selectedMin: '100', selectedMax: '500' })
      .mockResolvedValueOnce({ selectedMin: '100', selectedMax: null });
    const actionExecutor = new FilterActionExecutorServiceMock();
    actionExecutor.clickMinMaxOption.mockResolvedValue(true);
    const service = new FilterUpdateService(
      loader as unknown as FilterLoaderDetectionService,
      new FilterTextNormalizationService(),
      selectionReader as unknown as FilterSelectionReaderService,
      actionExecutor as unknown as FilterActionExecutorService
    );
    const expected = createSnapshot({
      name: 'Precio',
      cssSelector: '#price',
      type: FilterType.MIN_MAX,
      selectedMin: '100',
      selectedMax: null
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(actionExecutor.clickMinMaxOption).toHaveBeenCalledWith(expect.any(Object), expected.cssSelector, 'max', 'Máx');
    expect(selectionReader.readCurrentMinMaxSelection).toHaveBeenCalledTimes(2);
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
    const expected = createSnapshot({
      name: 'Habitaciones',
      cssSelector: '#rooms',
      type: FilterType.MULTIPLE_SELECTOR,
      selectedPlainOptions: ['B']
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
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
    const expected = createSnapshot({
      name: 'Tipo de inmueble',
      cssSelector: '#typology',
      type: FilterType.SINGLE_SELECTOR_DROPDOWN,
      selectedPlainOptions: ['Piso']
    });
    // Action
    await service.applyRequiredActions(createClient(), [expected], []);
    // Assert
    expect(loader.waitForPostClickStabilityOrReload).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalledWith('Reached maximum full reconciliation passes.');
  });
});
