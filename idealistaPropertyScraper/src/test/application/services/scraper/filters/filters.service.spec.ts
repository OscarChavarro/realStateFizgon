import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AsideFiltersPayload } from 'src/application/services/scraper/filters/aside-filters-payload.type';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { FilterAvailableOptionExtractor } from 'src/application/services/scraper/filters/filter-available-option-extractor.service';
import { FilterSelectedOptionExtractor } from 'src/application/services/scraper/filters/filter-selected-option-extractor.service';
import { FilterUpdateService } from 'src/application/services/scraper/filters/filter-update.service';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';
import { SupportedFilters } from 'src/application/services/scraper/filters/supported-filters';
import { Filter } from 'src/domain/filters/filter';
import { FilterType } from 'src/domain/filters/filter-type.enum';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

class FilterUpdateServiceMockForFiltersService {
  readonly applyRequiredActions = jest.fn<(client: CdpClient, preloaded: SupportedFilters, extracted: SupportedFilters) => Promise<void>>();
}

class FilterAvailableOptionExtractorMockForFiltersService {
  readonly extractSingleSelectorOptions = jest.fn<(client: CdpClient, selector: string) => Promise<string[]>>();
  readonly extractSingleSelectorDropdownOptions = jest.fn<(client: CdpClient, selector: string) => Promise<string[]>>();
  readonly extractMultipleSelectorOptions = jest.fn<(client: CdpClient, selector: string) => Promise<string[]>>();
  readonly extractMinMaxOptions = jest.fn<(
    client: CdpClient,
    selector: string
  ) => Promise<{ minOptions: string[]; maxOptions: string[] }>>();
}

class FilterSelectedOptionExtractorMockForFiltersService {
  readonly extractSelectedSingleSelectorOptions = jest.fn<(client: CdpClient, selector: string) => Promise<string[]>>();
  readonly extractSelectedSingleSelectorDropdownOptions = jest.fn<(client: CdpClient, selector: string) => Promise<string[]>>();
  readonly extractSelectedMultipleSelectorOptions = jest.fn<(client: CdpClient, selector: string) => Promise<string[]>>();
  readonly extractSelectedMinMax = jest.fn<(
    client: CdpClient,
    selector: string
  ) => Promise<{ selectedMin: string | null; selectedMax: string | null }>>();
}

class ScraperConfigMockForFiltersService {
  readonly getFilterDefinitionByName = jest.fn<(name: string) => {
    plainOptions?: string[];
    selectedPlainOptions?: string[];
    minOptions?: string[];
    maxOptions?: string[];
    selectedMin?: string | null;
    selectedMax?: string | null;
  } | undefined>();
}

class FakeFilter extends Filter {
  private minOptions: string[] = [];
  private maxOptions: string[] = [];

  constructor(name: string, cssSelector: string, type: FilterType | 'UNKNOWN') {
    super(name, cssSelector, type as FilterType);
  }

  override setMinOptions(options: string[]): void {
    this.minOptions = [...options];
  }

  override setMaxOptions(options: string[]): void {
    this.maxOptions = [...options];
  }

  getMinOptions(): string[] {
    return [...this.minOptions];
  }

  getMaxOptions(): string[] {
    return [...this.maxOptions];
  }
}

function createClient(
  evaluate: CdpClient['Runtime']['evaluate']
): CdpClient {
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

function createSupportedFilters(filters: Filter[]): SupportedFilters {
  return {
    getSupportedFilters: () => filters
  } as unknown as SupportedFilters;
}

function createService() {
  const filterUpdate = new FilterUpdateServiceMockForFiltersService();
  const available = new FilterAvailableOptionExtractorMockForFiltersService();
  const selected = new FilterSelectedOptionExtractorMockForFiltersService();
  const scraperConfig = new ScraperConfigMockForFiltersService();
  const service = new FiltersService(
    filterUpdate as unknown as FilterUpdateService,
    available as unknown as FilterAvailableOptionExtractor,
    selected as unknown as FilterSelectedOptionExtractor,
    scraperConfig as unknown as ScraperConfig
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: typeof logger }).logger = logger;
  return { service, filterUpdate, available, selected, scraperConfig, logger };
}

describe('FiltersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenAsideFiltersAreMissing_execute_shouldWarnAndSkipFilterUpdate', async () => {
    // Arrange
    const { service, filterUpdate, logger } = createService();
    const client = createClient(jest.fn(async () => ({ result: { value: { found: false, sections: [] } } })));
    // Action
    await service.execute(client);
    // Assert
    expect(client.Runtime.enable).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Filters root #aside-filters was not found on the page.');
    expect(filterUpdate.applyRequiredActions).not.toHaveBeenCalled();
  });

  it('whenAsideFilterReadThrows_execute_shouldPropagateRuntimeError', async () => {
    // Arrange
    const { service } = createService();
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'boom' } })));
    // Action
    const action = service.execute(client);
    // Assert
    await expect(action).rejects.toThrow('boom');
  });

  it('whenSingleSelectorFilterIsPresent_execute_shouldLoadAvailableAndSelectedOptions', async () => {
    // Arrange
    const { service, filterUpdate, available, selected } = createService();
    const filter = new FakeFilter('Estado', '#single', FilterType.SINGLE_SELECTOR);
    (service as unknown as { extractedFiltersFromDom: SupportedFilters }).extractedFiltersFromDom = createSupportedFilters([filter]);
    (service as unknown as { preloadedFiltersFromConfiguration: SupportedFilters }).preloadedFiltersFromConfiguration = createSupportedFilters([filter]);
    available.extractSingleSelectorOptions.mockResolvedValue(['nuevo', 'usado']);
    selected.extractSelectedSingleSelectorOptions.mockResolvedValue(['nuevo']);
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 0, name: 'Estado', normalized: 'estado' }]
    };
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('Boolean(document.querySelector')) {
        return { result: { value: true } };
      }
      return { result: { value: payload } };
    });
    const client = createClient(evaluate);
    // Action
    await service.execute(client);
    // Assert
    expect(available.extractSingleSelectorOptions).toHaveBeenCalledWith(client, '#single');
    expect(selected.extractSelectedSingleSelectorOptions).toHaveBeenCalledWith(client, '#single');
    expect(filterUpdate.applyRequiredActions).toHaveBeenCalledTimes(1);
  });

  it('whenMinMaxFilterIsPresent_execute_shouldLoadMinMaxOptionsAndSelection', async () => {
    // Arrange
    const { service, filterUpdate, available, selected } = createService();
    const filter = new FakeFilter('Precio', '#price', FilterType.MIN_MAX);
    (service as unknown as { extractedFiltersFromDom: SupportedFilters }).extractedFiltersFromDom = createSupportedFilters([filter]);
    (service as unknown as { preloadedFiltersFromConfiguration: SupportedFilters }).preloadedFiltersFromConfiguration = createSupportedFilters([filter]);
    available.extractMinMaxOptions.mockResolvedValue({ minOptions: ['Mín', '500'], maxOptions: ['1500', '2000'] });
    selected.extractSelectedMinMax.mockResolvedValue({ selectedMin: '500', selectedMax: '1500' });
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 0, name: 'Precio', normalized: 'precio' }]
    };
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('Boolean(document.querySelector')) {
        return { result: { value: true } };
      }
      return { result: { value: payload } };
    });
    const client = createClient(evaluate);
    // Action
    await service.execute(client);
    // Assert
    expect(available.extractMinMaxOptions).toHaveBeenCalledWith(client, '#price');
    expect(selected.extractSelectedMinMax).toHaveBeenCalledWith(client, '#price');
    expect(filter.getSelectedMin()).toBe('500');
  });

  it('whenPayloadContainsUnsupportedSections_execute_shouldLogUnsupportedSections', async () => {
    // Arrange
    const { service, filterUpdate, logger } = createService();
    (service as unknown as { extractedFiltersFromDom: SupportedFilters }).extractedFiltersFromDom = createSupportedFilters([]);
    (service as unknown as { preloadedFiltersFromConfiguration: SupportedFilters }).preloadedFiltersFromConfiguration = createSupportedFilters([]);
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 8, name: 'Filtro no soportado', normalized: 'filtro no soportado' }]
    };
    const client = createClient(jest.fn(async () => ({ result: { value: payload } })));
    // Action
    await service.execute(client);
    // Assert
    expect(filterUpdate.applyRequiredActions).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Not supported: Filtro no soportado');
  });

  it('whenFilterTypeIsUnknown_processFilter_shouldClearPlainOptions', async () => {
    // Arrange
    const { service } = createService();
    const unknownFilter = new FakeFilter('Custom', '#custom', 'UNKNOWN');
    unknownFilter.setPlainOptions(['A', 'B']);
    jest.spyOn(
      service as unknown as { isPresentBySelector: (client: CdpClient, selector: string) => Promise<boolean> },
      'isPresentBySelector'
    ).mockResolvedValue(true);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 0, name: 'Custom', normalized: 'custom' }]
    };
    const matchedIndexes = new Set<number>();
    const client = createClient(jest.fn(async () => ({ result: { value: true } })));
    // Action
    await (service as unknown as {
      processFilter: (clientArg: CdpClient, payloadArg: AsideFiltersPayload, filter: Filter, matched: Set<number>) => Promise<void>;
    }).processFilter(client, payload, unknownFilter, matchedIndexes);
    // Assert
    expect(unknownFilter.getSelectedPlainOptions()).toEqual([]);
    expect(matchedIndexes.has(0)).toBe(true);
  });

  it('whenFilterIsNotPresent_processFilter_shouldReturnWithoutProcessing', async () => {
    // Arrange
    const { service, available, selected } = createService();
    const filter = new FakeFilter('No existe', '#missing', FilterType.SINGLE_SELECTOR);
    jest.spyOn(
      service as unknown as { isPresentBySelector: (client: CdpClient, selector: string) => Promise<boolean> },
      'isPresentBySelector'
    ).mockResolvedValue(false);
    const payload: AsideFiltersPayload = { found: true, sections: [] };
    const matched = new Set<number>();
    const client = createClient(jest.fn(async () => ({ result: { value: false } })));
    // Action
    await (service as unknown as {
      processFilter: (clientArg: CdpClient, payloadArg: AsideFiltersPayload, filterArg: Filter, matchedArg: Set<number>) => Promise<void>;
    }).processFilter(client, payload, filter, matched);
    // Assert
    expect(available.extractSingleSelectorOptions).not.toHaveBeenCalled();
    expect(selected.extractSelectedSingleSelectorOptions).not.toHaveBeenCalled();
    expect(matched.size).toBe(0);
  });

  it.each([
    {
      label: 'dropdown',
      filter: new FakeFilter('Tipo de inmueble', '#dropdown', FilterType.SINGLE_SELECTOR_DROPDOWN),
      availableMockKey: 'extractSingleSelectorDropdownOptions',
      selectedMockKey: 'extractSelectedSingleSelectorDropdownOptions'
    },
    {
      label: 'multiple',
      filter: new FakeFilter('Habitaciones', '#multiple', FilterType.MULTIPLE_SELECTOR),
      availableMockKey: 'extractMultipleSelectorOptions',
      selectedMockKey: 'extractSelectedMultipleSelectorOptions'
    }
  ])('whenSupportedFilterTypeIs$label_execute_shouldExtractAvailableAndSelectedOptions', async ({
    filter,
    availableMockKey,
    selectedMockKey
  }) => {
    // Arrange
    const { service, filterUpdate, available, selected } = createService();
    (service as unknown as { extractedFiltersFromDom: SupportedFilters }).extractedFiltersFromDom = createSupportedFilters([filter]);
    (service as unknown as { preloadedFiltersFromConfiguration: SupportedFilters }).preloadedFiltersFromConfiguration = createSupportedFilters([filter]);
    (available as unknown as Record<string, { mockResolvedValue: (value: unknown) => void }>)[availableMockKey].mockResolvedValue(['A', 'B']);
    (selected as unknown as Record<string, { mockResolvedValue: (value: unknown) => void }>)[selectedMockKey].mockResolvedValue(['A']);
    filterUpdate.applyRequiredActions.mockResolvedValue(undefined);
    const payload: AsideFiltersPayload = {
      found: true,
      sections: [{ index: 0, name: filter.getName(), normalized: filter.getName().toLowerCase() }]
    };
    const evaluate = jest.fn<CdpClient['Runtime']['evaluate']>(async (params: { expression: string }) => {
      if (params.expression.includes('Boolean(document.querySelector')) {
        return { result: { value: true } };
      }
      return { result: { value: payload } };
    });
    const client = createClient(evaluate);
    // Action
    await service.execute(client);
    // Assert
    expect((available as unknown as Record<string, jest.Mock>)[availableMockKey]).toHaveBeenCalledWith(client, filter.getCssSelector());
    expect((selected as unknown as Record<string, jest.Mock>)[selectedMockKey]).toHaveBeenCalledWith(client, filter.getCssSelector());
    expect(filter.getSelectedPlainOptions()).toEqual(['A']);
  });

  it('whenAsidePayloadIsUndefined_readAsideFilters_shouldReturnNotFoundPayload', async () => {
    // Arrange
    const { service } = createService();
    const client = createClient(jest.fn(async () => ({ result: { value: undefined } })));
    // Action
    const payload = await (service as unknown as { readAsideFilters: (clientArg: CdpClient) => Promise<AsideFiltersPayload> }).readAsideFilters(client);
    // Assert
    expect(payload).toEqual({ found: false, sections: [] });
  });

  it('whenFilterDefinitionsExist_applyConfiguredFilterDefinitions_shouldPopulatePreloadedSelections', () => {
    // Arrange
    const filterUpdate = new FilterUpdateServiceMockForFiltersService();
    const available = new FilterAvailableOptionExtractorMockForFiltersService();
    const selected = new FilterSelectedOptionExtractorMockForFiltersService();
    const scraperConfig = {
      getFilterDefinitionByName: (name: string) => {
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
      }
    };
    const service = new FiltersService(
      filterUpdate as unknown as FilterUpdateService,
      available as unknown as FilterAvailableOptionExtractor,
      selected as unknown as FilterSelectedOptionExtractor,
      scraperConfig as unknown as ScraperConfig
    );
    // Action
    const preloaded = (service as unknown as { preloadedFiltersFromConfiguration: SupportedFilters }).preloadedFiltersFromConfiguration.getSupportedFilters();
    const price = preloaded.find((item) => item.getName() === 'Precio') as Filter | undefined;
    const rooms = preloaded.find((item) => item.getName() === 'Habitaciones') as Filter | undefined;
    // Assert
    expect((price as unknown as { minOptions: string[] }).minOptions).toEqual(['0']);
    expect((price as unknown as { maxOptions: string[] }).maxOptions).toEqual(['1200']);
    expect(price?.getSelectedMin()).toBe('0');
    expect(price?.getSelectedMax()).toBe('1200');
    expect((rooms as unknown as { plainOptions: string[] }).plainOptions).toEqual(['1', '2']);
    expect(rooms?.getSelectedPlainOptions()).toEqual(['2']);
  });
});
