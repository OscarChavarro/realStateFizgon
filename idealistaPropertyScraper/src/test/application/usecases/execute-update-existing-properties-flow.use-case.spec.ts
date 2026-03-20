import { describe, expect, it, jest } from '@jest/globals';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'src/application/usecases/execute-update-existing-properties-flow.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../ports/outbound/persistence/property-persistence-port.mock';

class SearchResultsPreparationServiceMockForExecuteUpdateExistingPropertiesFlowUseCase {
  readonly prepareSearchResultsWithFilters = jest.fn<(
    client: ScraperCdpClient,
    page: ScraperCdpClient['Page'],
    runtime: ScraperCdpClient['Runtime']
  ) => Promise<void>>();
}

class PropertyListPageServiceMockForExecuteUpdateExistingPropertiesFlowUseCase {
  readonly resetProcessedUrlsForCurrentSearch = jest.fn<() => void>();
  readonly processExistingUrls = jest.fn<(client: ScraperCdpClient, urls: string[]) => Promise<void>>();
}

function createClient(): ScraperCdpClient {
  return {
    Page: {
      enable: jest.fn(async () => undefined),
      bringToFront: jest.fn(async () => undefined),
      navigate: jest.fn(async () => ({ frameId: 'frame' }))
    },
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    close: jest.fn(async () => undefined)
  } as unknown as ScraperCdpClient;
}

describe('ExecuteUpdateExistingPropertiesFlowUseCase', () => {
  it.each([
    {
      missingUrls: ['https://idealista.com/inmueble/1/'],
      openUrls: ['https://idealista.com/inmueble/1/', 'https://idealista.com/inmueble/2/'],
      expectedCalls: [['https://idealista.com/inmueble/1/'], ['https://idealista.com/inmueble/1/', 'https://idealista.com/inmueble/2/']]
    },
    {
      missingUrls: [],
      openUrls: ['https://idealista.com/inmueble/3/'],
      expectedCalls: [['https://idealista.com/inmueble/3/']]
    }
  ])('whenUseCaseRuns_execute_shouldProcessMissingLastTimeVisitedBeforeFullOpenSet', async ({
    missingUrls,
    openUrls,
    expectedCalls
  }) => {
    // Arrange
    const search = new SearchResultsPreparationServiceMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const mongo = new PropertyPersistencePortMock();
    const list = new PropertyListPageServiceMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const useCase = new ExecuteUpdateExistingPropertiesFlowUseCase(
      search as unknown as SearchResultsPreparationService,
      mongo as unknown as PropertyPersistencePort,
      list as unknown as PropertyListPageService
    );
    const client = createClient();
    mongo.getOpenPropertyUrlsWithoutLastTimeVisited.mockResolvedValue(missingUrls);
    mongo.getOpenPropertyUrls.mockResolvedValue(openUrls);

    // Action
    await useCase.execute(client);

    // Assert
    expect(search.prepareSearchResultsWithFilters).toHaveBeenCalledWith(client, client.Page, client.Runtime);
    expect(list.resetProcessedUrlsForCurrentSearch).toHaveBeenCalledTimes(1);
    expect(list.processExistingUrls.mock.calls.map((call) => call[1])).toEqual(expectedCalls);
  });
});
