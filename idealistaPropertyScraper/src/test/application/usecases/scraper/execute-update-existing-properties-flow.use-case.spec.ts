import { describe, expect, it, jest } from '@jest/globals';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-update-existing-properties-flow.use-case';
import { RevalidateOpenPropertiesFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-open-properties-from-database.use-case';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'src/application/usecases/scraper/revalidate-properties-without-last-visit.use-case';

import type { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
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

class RevalidateOpenPropertiesFromDatabaseUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase {
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
    const list = new PropertyListPageServiceMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const revalidateWithoutVisit = new RevalidatePropertiesWithoutLastVisitUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const revalidateOpenFromDb = new RevalidateOpenPropertiesFromDatabaseUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const useCase = new ExecuteUpdateExistingPropertiesFlowUseCase(
      search as unknown as SearchResultsPreparationService,
      revalidateWithoutVisit as unknown as RevalidatePropertiesWithoutLastVisitUseCase,
      revalidateOpenFromDb as unknown as RevalidateOpenPropertiesFromDatabaseUseCase,
      list as unknown as PropertyListPageService
    );
    const client = createClient();
    revalidateWithoutVisit.execute.mockResolvedValue(undefined);
    revalidateOpenFromDb.execute.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client);

    // Assert
    expect(search.prepareSearchResultsWithFilters).toHaveBeenCalledWith(client, client.Page, client.Runtime);
    expect(list.resetProcessedUrlsForCurrentSearch).toHaveBeenCalledTimes(1);
    expect(revalidateWithoutVisit.execute).toHaveBeenCalledTimes(1);
    expect(revalidateWithoutVisit.execute).toHaveBeenCalledWith(client);
    expect(revalidateOpenFromDb.execute).toHaveBeenCalledTimes(1);
    expect(revalidateOpenFromDb.execute).toHaveBeenCalledWith(client);
  });
});
