import { describe, expect, it, jest } from '@jest/globals';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-update-existing-properties-flow.use-case';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'src/application/usecases/scraper/revalidate-properties-without-last-visit.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

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

class RevalidatePropertiesWithoutLastVisitUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase {
  readonly execute = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
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
  it('whenUseCaseRuns_execute_shouldPrepareResetAndRevalidateWithoutVisitBeforeFullOpenSet', async () => {
    // Arrange
    const search = new SearchResultsPreparationServiceMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const mongo = new PropertyPersistencePortMock();
    const list = new PropertyListPageServiceMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const revalidateWithoutVisit = new RevalidatePropertiesWithoutLastVisitUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const useCase = new ExecuteUpdateExistingPropertiesFlowUseCase(
      search as unknown as SearchResultsPreparationService,
      mongo as unknown as PropertyPersistencePort,
      revalidateWithoutVisit as unknown as RevalidatePropertiesWithoutLastVisitUseCase,
      list as unknown as PropertyListPageService
    );
    const client = createClient();
    const openUrls = ['https://idealista.com/inmueble/1/', 'https://idealista.com/inmueble/2/'];
    mongo.getOpenPropertyUrls.mockResolvedValue(openUrls);
    revalidateWithoutVisit.execute.mockResolvedValue(undefined);
    list.processExistingUrls.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client);

    // Assert
    expect(search.prepareSearchResultsWithFilters).toHaveBeenCalledWith(client, client.Page, client.Runtime);
    expect(list.resetProcessedUrlsForCurrentSearch).toHaveBeenCalledTimes(1);
    expect(revalidateWithoutVisit.execute).toHaveBeenCalledTimes(1);
    expect(revalidateWithoutVisit.execute).toHaveBeenCalledWith(client);
    expect(list.processExistingUrls).toHaveBeenCalledTimes(1);
    expect(list.processExistingUrls).toHaveBeenCalledWith(client, openUrls);
  });
});
