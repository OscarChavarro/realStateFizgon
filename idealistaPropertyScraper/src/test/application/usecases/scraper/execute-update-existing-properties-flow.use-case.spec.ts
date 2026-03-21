import { describe, expect, it, jest } from '@jest/globals';
import { createScrapeRunContext, ScrapeRunContext } from 'application/context/scrape-run-context';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'application/usecases/scraper/execute-update-existing-properties-flow.use-case';
import { PrepareSearchResultsUseCase } from 'application/usecases/scraper/prepare-search-results.use-case';
import { RevalidateOpenPropertiesFromDatabaseUseCase } from 'application/usecases/scraper/revalidate-open-properties-from-database.use-case';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'application/usecases/scraper/revalidate-properties-without-last-visit.use-case';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
class PrepareSearchResultsUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase {
  readonly execute = jest.fn<(
    client: ScraperCdpClient,
    page: ScraperCdpClient['Page'],
    runtime: ScraperCdpClient['Runtime'],
    scrapeRunContext: ScrapeRunContext
  ) => Promise<void>>();
}

class PropertyListPageServiceMockForExecuteUpdateExistingPropertiesFlowUseCase {
  readonly processExistingUrls = jest.fn<
    (client: ScraperCdpClient, urls: string[], scrapeRunContext: ScrapeRunContext) => Promise<void>
  >();
}

class RevalidatePropertiesWithoutLastVisitUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase {
  readonly execute = jest.fn<(client: ScraperCdpClient, scrapeRunContext: ScrapeRunContext) => Promise<void>>();
}

class RevalidateOpenPropertiesFromDatabaseUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase {
  readonly execute = jest.fn<(client: ScraperCdpClient, scrapeRunContext: ScrapeRunContext) => Promise<void>>();
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
    const prepareSearchResultsUseCase = new PrepareSearchResultsUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const list = new PropertyListPageServiceMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const revalidateWithoutVisit = new RevalidatePropertiesWithoutLastVisitUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const revalidateOpenFromDb = new RevalidateOpenPropertiesFromDatabaseUseCaseMockForExecuteUpdateExistingPropertiesFlowUseCase();
    const useCase = new ExecuteUpdateExistingPropertiesFlowUseCase(
      prepareSearchResultsUseCase as unknown as PrepareSearchResultsUseCase,
      revalidateWithoutVisit as unknown as RevalidatePropertiesWithoutLastVisitUseCase,
      revalidateOpenFromDb as unknown as RevalidateOpenPropertiesFromDatabaseUseCase,
      list as unknown as PropertyListPageService
    );
    const client = createClient();
    const scrapeRunContext = createScrapeRunContext();
    revalidateWithoutVisit.execute.mockResolvedValue(undefined);
    revalidateOpenFromDb.execute.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, scrapeRunContext);

    // Assert
    expect(prepareSearchResultsUseCase.execute).toHaveBeenCalledWith(client, client.Page, client.Runtime, scrapeRunContext);
    expect(revalidateWithoutVisit.execute).toHaveBeenCalledTimes(1);
    expect(revalidateWithoutVisit.execute).toHaveBeenCalledWith(client, scrapeRunContext);
    expect(revalidateOpenFromDb.execute).toHaveBeenCalledTimes(1);
    expect(revalidateOpenFromDb.execute).toHaveBeenCalledWith(client, scrapeRunContext);
  });
});
