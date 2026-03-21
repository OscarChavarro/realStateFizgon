import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FilterSnapshot } from 'application/services/scraper/filters/filter-snapshot.type';
import { FilterAvailableOptionExtractorService } from 'application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterSelectedOptionExtractorService } from 'application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterUpdateService } from 'application/services/scraper/filters/filter-update.service';
import { ApplySearchFiltersUseCase } from 'application/usecases/scraper/apply-search-filters.use-case';
import { FilterType } from 'domain/filters/filter-type';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';

import type { AsideFiltersPayload } from 'application/dto/scraper/aside-filters-payload.dto';
import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';

class FilterUpdateServiceMockForApplySearchFiltersUseCase {
  readonly applyRequiredActions = jest.fn<(
    client: FiltersCdpClient,
    preloaded: readonly FilterSnapshot[],
    extracted: readonly FilterSnapshot[]
  ) => Promise<void>>();
}

class FilterAvailableOptionExtractorMockForApplySearchFiltersUseCase {
  readonly extractSingleSelectorOptions = jest.fn<(client: FiltersCdpClient, selector: string) => Promise<string[]>>();
  readonly extractSingleSelectorDropdownOptions = jest.fn<(client: FiltersCdpClient, selector: string) => Promise<string[]>>();
  readonly extractMultipleSelectorOptions = jest.fn<(client: FiltersCdpClient, selector: string) => Promise<string[]>>();
  readonly extractMinMaxOptions = jest.fn<(
    client: FiltersCdpClient,
    selector: string
  ) => Promise<{ minOptions: string[]; maxOptions: string[] }>>();
}

class FilterSelectedOptionExtractorMockForApplySearchFiltersUseCase {
  readonly extractSelectedSingleSelectorOptions = jest.fn<(client: FiltersCdpClient, selector: string) => Promise<string[]>>();
  readonly extractSelectedSingleSelectorDropdownOptions = jest.fn<(client: FiltersCdpClient, selector: string) => Promise<string[]>>();
  readonly extractSelectedMultipleSelectorOptions = jest.fn<(client: FiltersCdpClient, selector: string) => Promise<string[]>>();
  readonly extractSelectedMinMax = jest.fn<(
    client: FiltersCdpClient,
    selector: string
  ) => Promise<{ selectedMin: string | null; selectedMax: string | null }>>();
}

class ScraperConfigMockForApplySearchFiltersUseCase {
  readonly getFilterDefinitionByName = jest.fn<(name: string) => {
    plainOptions?: string[];
    selectedPlainOptions?: string[];
    minOptions?: string[];
    maxOptions?: string[];
    selectedMin?: string | null;
    selectedMax?: string | null;
  } | undefined>();
}

function createClient(
  evaluate: FiltersCdpClient['Runtime']['evaluate']
): FiltersCdpClient {
  return {
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate
    },
    Page: {
      reload: jest.fn(async () => undefined),
      loadEventFired: jest.fn()
    }
  };
}

function createSnapshot(overrides: Partial<FilterSnapshot> = {}): FilterSnapshot {
  const plainOptions = [...(overrides.plainOptions ?? [])];
  const selectedPlainOptions = [...(overrides.selectedPlainOptions ?? [])];
  const minOptions = [...(overrides.minOptions ?? [])];
  const maxOptions = [...(overrides.maxOptions ?? [])];

  return Object.freeze({
    name: overrides.name ?? 'Estado',
    cssSelector: overrides.cssSelector ?? '#estado',
    type: overrides.type ?? FilterType.SINGLE_SELECTOR,
    plainOptions: Object.freeze(plainOptions),
    selectedPlainOptions: Object.freeze(selectedPlainOptions),
    minOptions: Object.freeze(minOptions),
    maxOptions: Object.freeze(maxOptions),
    selectedMin: overrides.selectedMin ?? null,
    selectedMax: overrides.selectedMax ?? null
  });
}

function createUseCase() {
  const filterUpdate = new FilterUpdateServiceMockForApplySearchFiltersUseCase();
  const available = new FilterAvailableOptionExtractorMockForApplySearchFiltersUseCase();
  const selected = new FilterSelectedOptionExtractorMockForApplySearchFiltersUseCase();
  const scraperConfig = new ScraperConfigMockForApplySearchFiltersUseCase();
  const useCase = new ApplySearchFiltersUseCase(
    filterUpdate as unknown as FilterUpdateService,
    available as unknown as FilterAvailableOptionExtractorService,
    selected as unknown as FilterSelectedOptionExtractorService,
    scraperConfig as unknown as ScraperConfig
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;
  return { useCase, filterUpdate, available, selected, scraperConfig, logger };
}

describe('ApplySearchFiltersUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenAsideFiltersAreMissing_execute_shouldWarnAndSkipFilterUpdate', async () => {
    // Arrange
    const { useCase, filterUpdate, logger } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: { value: { found: false, sections: [] } } })));
    // Action
    await useCase.execute(client);
    // Assert
    expect(client.Runtime.enable).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Filters root #aside-filters was not found on the page.');
    expect(filterUpdate.applyRequiredActions).not.toHaveBeenCalled();
  });

  it('whenAsideFilterReadThrows_execute_shouldPropagateRuntimeError', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'boom' } })));
    // Action
    const action = useCase.execute(client);
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenSingleSelectorFilterIsPresent_execute_shouldBuildPerExecutionSnapshotAndDelegate', async () => {
    // Arrange
    const { useCase, filterUpdate, available, selected } = createUseCase();
    const filterSnapshot = createSnapshot({
      name: 'Estado',
      cssSelector: '#single',
      type: FilterType.SINGLE_SELECTOR
    });
    jest.spyOn(useCase as unknown as { buildBaseFilterSnapshots: () => readonly FilterSnapshot[] }, 'buildBaseFilterSnapshots')
      .mockReturnValue([filterSnapshot]);

    available.extractSingleSelectorOptions.mockResolvedValue(['nuevo', 'usado']);
    selected.extractSelectedSingleSelectorOptions.mockResolvedValue(['nuevo']);
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);

    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 0, name: 'Estado', normalized: 'estado' }]
    };
    const evaluate = jest.fn<FiltersCdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('Boolean(document.querySelector')) {
        return { result: { value: true } };
      }
      return { result: { value: payload } };
    });
    const client = createClient(evaluate);
    // Action
    await useCase.execute(client);
    // Assert
    expect(available.extractSingleSelectorOptions).toHaveBeenCalledWith(client, '#single');
    expect(selected.extractSelectedSingleSelectorOptions).toHaveBeenCalledWith(client, '#single');
    expect(filterUpdate.applyRequiredActions).toHaveBeenCalledTimes(1);
    const [, preloaded, extracted] = filterUpdate.applyRequiredActions.mock.calls[0] ?? [];
    expect(preloaded).toHaveLength(1);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]?.selectedPlainOptions).toEqual(['nuevo']);
    expect(Object.isFrozen(extracted[0])).toBe(true);
  });

  it('whenMinMaxFilterIsPresent_execute_shouldBuildMinMaxSnapshot', async () => {
    // Arrange
    const { useCase, filterUpdate, available, selected } = createUseCase();
    const filterSnapshot = createSnapshot({
      name: 'Precio',
      cssSelector: '#price',
      type: FilterType.MIN_MAX
    });
    jest.spyOn(useCase as unknown as { buildBaseFilterSnapshots: () => readonly FilterSnapshot[] }, 'buildBaseFilterSnapshots')
      .mockReturnValue([filterSnapshot]);

    available.extractMinMaxOptions.mockResolvedValue({ minOptions: ['Mín', '500'], maxOptions: ['1500', '2000'] });
    selected.extractSelectedMinMax.mockResolvedValue({ selectedMin: '500', selectedMax: '1500' });
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);

    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 0, name: 'Precio', normalized: 'precio' }]
    };
    const evaluate = jest.fn<FiltersCdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('Boolean(document.querySelector')) {
        return { result: { value: true } };
      }
      return { result: { value: payload } };
    });
    const client = createClient(evaluate);
    // Action
    await useCase.execute(client);
    // Assert
    expect(available.extractMinMaxOptions).toHaveBeenCalledWith(client, '#price');
    expect(selected.extractSelectedMinMax).toHaveBeenCalledWith(client, '#price');
    const [, , extracted] = filterUpdate.applyRequiredActions.mock.calls[0] ?? [];
    expect(extracted[0]?.selectedMin).toBe('500');
    expect(extracted[0]?.selectedMax).toBe('1500');
  });

  it('whenDropdownFilterIsPresent_processFilter_shouldExtractDropdownOptionsAndSelection', async () => {
    // Arrange
    const { useCase, available, selected } = createUseCase();
    const filter = createSnapshot({
      name: 'Tipo de inmueble',
      cssSelector: '#typology',
      type: FilterType.SINGLE_SELECTOR_DROPDOWN
    });
    jest.spyOn(
      useCase as unknown as { isPresentBySelector: (client: FiltersCdpClient, selector: string) => Promise<boolean> },
      'isPresentBySelector'
    ).mockResolvedValue(true);
    available.extractSingleSelectorDropdownOptions.mockResolvedValue(['Piso', 'Ático']);
    selected.extractSelectedSingleSelectorDropdownOptions.mockResolvedValue(['Piso']);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 1, name: 'Tipo de inmueble', normalized: 'tipo de inmueble' }]
    };
    const matched = new Set<number>();
    const client = createClient(jest.fn(async () => ({ result: { value: true } })));
    // Action
    const result = await (useCase as unknown as {
      processFilter: (
        clientArg: FiltersCdpClient,
        payloadArg: AsideFiltersPayload,
        filterArg: FilterSnapshot,
        matchedArg: Set<number>
      ) => Promise<FilterSnapshot | null>;
    }).processFilter(client, payload, filter, matched);
    // Assert
    expect(available.extractSingleSelectorDropdownOptions).toHaveBeenCalledWith(client, '#typology');
    expect(selected.extractSelectedSingleSelectorDropdownOptions).toHaveBeenCalledWith(client, '#typology');
    expect(result?.plainOptions).toEqual(['Piso', 'Ático']);
    expect(result?.selectedPlainOptions).toEqual(['Piso']);
    expect(matched.has(1)).toBe(true);
  });

  it('whenMultipleSelectorFilterIsPresent_processFilter_shouldExtractMultipleOptionsAndSelection', async () => {
    // Arrange
    const { useCase, available, selected } = createUseCase();
    const filter = createSnapshot({
      name: 'Habitaciones',
      cssSelector: '#rooms',
      type: FilterType.MULTIPLE_SELECTOR
    });
    jest.spyOn(
      useCase as unknown as { isPresentBySelector: (client: FiltersCdpClient, selector: string) => Promise<boolean> },
      'isPresentBySelector'
    ).mockResolvedValue(true);
    available.extractMultipleSelectorOptions.mockResolvedValue(['1', '2', '3+']);
    selected.extractSelectedMultipleSelectorOptions.mockResolvedValue(['2']);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 3, name: 'Habitaciones', normalized: 'habitaciones' }]
    };
    const matched = new Set<number>();
    const client = createClient(jest.fn(async () => ({ result: { value: true } })));
    // Action
    const result = await (useCase as unknown as {
      processFilter: (
        clientArg: FiltersCdpClient,
        payloadArg: AsideFiltersPayload,
        filterArg: FilterSnapshot,
        matchedArg: Set<number>
      ) => Promise<FilterSnapshot | null>;
    }).processFilter(client, payload, filter, matched);
    // Assert
    expect(available.extractMultipleSelectorOptions).toHaveBeenCalledWith(client, '#rooms');
    expect(selected.extractSelectedMultipleSelectorOptions).toHaveBeenCalledWith(client, '#rooms');
    expect(result?.plainOptions).toEqual(['1', '2', '3+']);
    expect(result?.selectedPlainOptions).toEqual(['2']);
    expect(matched.has(3)).toBe(true);
  });

  it('whenFilterTypeIsUnknown_processFilter_shouldReturnDefaultSnapshotWithEmptyPlainSelections', async () => {
    // Arrange
    const { useCase, available, selected } = createUseCase();
    const filter = createSnapshot({
      name: 'Desconocido',
      cssSelector: '#unknown',
      type: 'UNKNOWN' as FilterType,
      plainOptions: ['X'],
      selectedPlainOptions: ['Y']
    });
    jest.spyOn(
      useCase as unknown as { isPresentBySelector: (client: FiltersCdpClient, selector: string) => Promise<boolean> },
      'isPresentBySelector'
    ).mockResolvedValue(true);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 7, name: 'Desconocido', normalized: 'desconocido' }]
    };
    const matched = new Set<number>();
    const client = createClient(jest.fn(async () => ({ result: { value: true } })));
    // Action
    const result = await (useCase as unknown as {
      processFilter: (
        clientArg: FiltersCdpClient,
        payloadArg: AsideFiltersPayload,
        filterArg: FilterSnapshot,
        matchedArg: Set<number>
      ) => Promise<FilterSnapshot | null>;
    }).processFilter(client, payload, filter, matched);
    // Assert
    expect(result?.plainOptions).toEqual([]);
    expect(result?.selectedPlainOptions).toEqual([]);
    expect(available.extractSingleSelectorOptions).not.toHaveBeenCalled();
    expect(selected.extractSelectedSingleSelectorOptions).not.toHaveBeenCalled();
  });

  it('whenPayloadContainsUnsupportedSections_execute_shouldLogUnsupportedSections', async () => {
    // Arrange
    const { useCase, filterUpdate, logger } = createUseCase();
    jest.spyOn(useCase as unknown as { buildBaseFilterSnapshots: () => readonly FilterSnapshot[] }, 'buildBaseFilterSnapshots')
      .mockReturnValue([]);
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 8, name: 'Filtro no soportado', normalized: 'filtro no soportado' }]
    };
    const client = createClient(jest.fn(async () => ({ result: { value: payload } })));
    // Action
    await useCase.execute(client);
    // Assert
    expect(filterUpdate.applyRequiredActions).toHaveBeenCalledWith(client, [], []);
    expect(logger.log).toHaveBeenCalledWith('Not supported: Filtro no soportado');
  });

  it('whenAsideFiltersPayloadIsUndefined_execute_shouldUseMissingFallback', async () => {
    // Arrange
    const { useCase, filterUpdate, logger } = createUseCase();
    const client = createClient(jest.fn(async () => ({ result: { value: undefined } })));
    // Action
    await useCase.execute(client);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Filters root #aside-filters was not found on the page.');
    expect(filterUpdate.applyRequiredActions).not.toHaveBeenCalled();
  });

  it('whenFilterIsMissingDuringExecute_execute_shouldSkipAddingItToExtractedSnapshots', async () => {
    // Arrange
    const { useCase, filterUpdate } = createUseCase();
    const missingFilter = createSnapshot({
      name: 'No existe',
      cssSelector: '#missing',
      type: FilterType.SINGLE_SELECTOR
    });
    jest.spyOn(useCase as unknown as { buildBaseFilterSnapshots: () => readonly FilterSnapshot[] }, 'buildBaseFilterSnapshots')
      .mockReturnValue([missingFilter]);
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);
    const payload: AsideFiltersPayload = { found: true, sections: [] };
    const evaluate = jest.fn<FiltersCdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('Boolean(document.querySelector')) {
        return { result: { value: false } };
      }
      return { result: { value: payload } };
    });
    const client = createClient(evaluate);
    // Action
    await useCase.execute(client);
    // Assert
    const [, , extracted] = filterUpdate.applyRequiredActions.mock.calls[0] ?? [];
    expect(extracted).toEqual([]);
  });

  it('whenFilterIsNotPresent_processFilter_shouldReturnNull', async () => {
    // Arrange
    const { useCase, available, selected } = createUseCase();
    const filter = createSnapshot({
      name: 'No existe',
      cssSelector: '#missing',
      type: FilterType.SINGLE_SELECTOR
    });
    jest.spyOn(
      useCase as unknown as { isPresentBySelector: (client: FiltersCdpClient, selector: string) => Promise<boolean> },
      'isPresentBySelector'
    ).mockResolvedValue(false);
    const payload: AsideFiltersPayload = { found: true, sections: [] };
    const matched = new Set<number>();
    const client = createClient(jest.fn(async () => ({ result: { value: false } })));
    // Action
    const result = await (useCase as unknown as {
      processFilter: (
        clientArg: FiltersCdpClient,
        payloadArg: AsideFiltersPayload,
        filterArg: FilterSnapshot,
        matchedArg: Set<number>
      ) => Promise<FilterSnapshot | null>;
    }).processFilter(client, payload, filter, matched);
    // Assert
    expect(result).toBeNull();
    expect(available.extractSingleSelectorOptions).not.toHaveBeenCalled();
    expect(selected.extractSelectedSingleSelectorOptions).not.toHaveBeenCalled();
    expect(matched.size).toBe(0);
  });

  it('whenSupportedNameContainsSectionName_matches_shouldReturnTrueOnReverseIncludeBranch', () => {
    // Arrange
    const { useCase } = createUseCase();
    // Action
    const result = (useCase as unknown as { matches: (sectionName: string, supportedName: string) => boolean })
      .matches('tipo', 'tipo de inmueble');
    // Assert
    expect(result).toBe(true);
  });

  it('whenFilterDefinitionsExist_buildConfiguredFilterSnapshots_shouldPopulateImmutableSelections', () => {
    // Arrange
    const { useCase, scraperConfig } = createUseCase();
    scraperConfig.getFilterDefinitionByName.mockImplementation((name: string) => {
      if (name === 'Precio') {
        return {
          minOptions: ['0'],
          maxOptions: ['1200'],
          selectedMin: '0',
          selectedMax: '1200'
        };
      }
      if (name === 'Habitaciones') {
        return {
          plainOptions: ['1', '2'],
          selectedPlainOptions: ['2']
        };
      }
      return undefined;
    });
    const baseSnapshots = [
      createSnapshot({ name: 'Precio', cssSelector: '#price', type: FilterType.MIN_MAX }),
      createSnapshot({ name: 'Habitaciones', cssSelector: '#rooms', type: FilterType.MULTIPLE_SELECTOR })
    ];
    // Action
    const configured = (useCase as unknown as {
      buildConfiguredFilterSnapshots: (base: readonly FilterSnapshot[]) => readonly FilterSnapshot[];
    }).buildConfiguredFilterSnapshots(baseSnapshots);
    // Assert
    expect(configured[0]?.minOptions).toEqual(['0']);
    expect(configured[0]?.maxOptions).toEqual(['1200']);
    expect(configured[0]?.selectedMin).toBe('0');
    expect(configured[0]?.selectedMax).toBe('1200');
    expect(configured[1]?.plainOptions).toEqual(['1', '2']);
    expect(configured[1]?.selectedPlainOptions).toEqual(['2']);
    expect(Object.isFrozen(configured[0])).toBe(true);
    expect(Object.isFrozen(configured[0]?.plainOptions)).toBe(true);
    expect(baseSnapshots[0]?.selectedMin).toBeNull();
    expect(baseSnapshots[1]?.selectedPlainOptions).toEqual([]);
  });

  it('whenBaseSnapshotsAreBuilt_buildBaseFilterSnapshots_shouldReturnImmutableDefaultsForSupportedFilters', () => {
    // Arrange
    const { useCase } = createUseCase();
    // Action
    const baseSnapshots = (useCase as unknown as { buildBaseFilterSnapshots: () => readonly FilterSnapshot[] }).buildBaseFilterSnapshots();
    // Assert
    expect(baseSnapshots.length).toBeGreaterThan(0);
    expect(baseSnapshots.some((filter) => filter.name === 'Precio')).toBe(true);
    expect(baseSnapshots.every((filter) => filter.plainOptions.length === 0)).toBe(true);
    expect(baseSnapshots.every((filter) => filter.selectedPlainOptions.length === 0)).toBe(true);
    expect(baseSnapshots.every((filter) => filter.selectedMin === null && filter.selectedMax === null)).toBe(true);
    expect(Object.isFrozen(baseSnapshots)).toBe(true);
    expect(Object.isFrozen(baseSnapshots[0] as object)).toBe(true);
  });
});
