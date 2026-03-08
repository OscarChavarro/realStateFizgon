import { describe, expect, it, jest } from '@jest/globals';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';
import { MongoDatabaseServiceMock } from '../../../../support/mocks/mongo-database-service.mock';

class SearchResultsPreparationServiceMock {
  readonly prepareSearchResultsWithFilters = jest.fn<(
    client: ScraperCdpClient,
    page: ScraperCdpClient['Page'],
    runtime: ScraperCdpClient['Runtime']
  ) => Promise<void>>();
}

class PropertyListPageServiceMock {
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

describe('UpdateExistingPropertiesFlowService', () => {
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
  ])('whenUpdateFlowRuns_execute_shouldProcessMissingLastTimeVisitedBeforeFullOpenSet', async ({
    missingUrls,
    openUrls,
    expectedCalls
  }) => {
    // Arrange
    const search = new SearchResultsPreparationServiceMock();
    const mongo = new MongoDatabaseServiceMock();
    const list = new PropertyListPageServiceMock();
    const service = new UpdateExistingPropertiesFlowService(
      search as unknown as SearchResultsPreparationService,
      mongo as unknown as MongoDatabaseService,
      list as unknown as PropertyListPageService
    );
    const client = createClient();
    mongo.getOpenPropertyUrlsWithoutLastTimeVisited.mockResolvedValue(missingUrls);
    mongo.getOpenPropertyUrls.mockResolvedValue(openUrls);
    // Action
    await service.execute(client);
    // Assert
    expect(search.prepareSearchResultsWithFilters).toHaveBeenCalledWith(client, client.Page, client.Runtime);
    expect(list.resetProcessedUrlsForCurrentSearch).toHaveBeenCalledTimes(1);
    expect(list.processExistingUrls.mock.calls.map((call) => call[1])).toEqual(expectedCalls);
  });
});
