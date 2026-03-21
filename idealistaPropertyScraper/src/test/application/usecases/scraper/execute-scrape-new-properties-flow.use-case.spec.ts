import { describe, expect, it, jest } from '@jest/globals';
import { createScrapeRunContext, ScrapeRunContext } from 'application/context/scrape-run-context';
import { PropertyListingPaginationService } from 'application/services/scraper/pagination/property-listing-pagination.service';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'application/usecases/scraper/execute-scrape-new-properties-flow.use-case';
import { PrepareSearchResultsUseCase } from 'application/usecases/scraper/prepare-search-results.use-case';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
class PrepareSearchResultsUseCaseMockForExecuteScrapeNewPropertiesFlowUseCase {
  readonly execute = jest.fn<
    (
      client: ScraperCdpClient,
      page: ScraperCdpClient['Page'],
      runtime: ScraperCdpClient['Runtime'],
      scrapeRunContext: ScrapeRunContext
    ) => Promise<void>
  >();
}

class PropertyListingPaginationServiceMockForExecuteScrapeNewPropertiesFlowUseCase {
  readonly execute = jest.fn<(client: ScraperCdpClient, scrapeRunContext: ScrapeRunContext) => Promise<void>>();
}

function createClient(): ScraperCdpClient {
  return {
    Page: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      bringToFront: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      navigate: jest.fn<(params: { url: string }) => Promise<void>>().mockResolvedValue(undefined),
      reload: jest.fn<(params?: { ignoreCache?: boolean }) => Promise<void>>().mockResolvedValue(undefined),
      loadEventFired: jest.fn<(cb: () => void) => void>(),
      frameNavigated: jest.fn<(cb: (event: { frame?: { url?: string } }) => void) => void>()
    },
    Runtime: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    Network: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      responseReceived: jest.fn(),
      loadingFinished: jest.fn(),
      loadingFailed: jest.fn(),
      getResponseBody: jest.fn(async () => ({ body: '', base64Encoded: false }))
    },
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };
}

function createUseCase() {
  const prepareSearchResultsUseCase = new PrepareSearchResultsUseCaseMockForExecuteScrapeNewPropertiesFlowUseCase();
  const propertyListingPaginationService = new PropertyListingPaginationServiceMockForExecuteScrapeNewPropertiesFlowUseCase();
  const useCase = new ExecuteScrapeNewPropertiesFlowUseCase(
    prepareSearchResultsUseCase as unknown as PrepareSearchResultsUseCase,
    propertyListingPaginationService as unknown as PropertyListingPaginationService
  );
  const logger = {
    log: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;

  return {
    useCase,
    prepareSearchResultsUseCase,
    propertyListingPaginationService,
    logger
  };
}

describe('ExecuteScrapeNewPropertiesFlowUseCase', () => {
  it('whenPreparationAndPaginationSucceed_execute_shouldRunFlowAndLogFinish', async () => {
    // Arrange
    const { useCase, prepareSearchResultsUseCase, propertyListingPaginationService, logger } = createUseCase();
    const client = createClient();
    const scrapeRunContext = createScrapeRunContext();
    prepareSearchResultsUseCase.execute.mockResolvedValue(undefined);
    propertyListingPaginationService.execute.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client, scrapeRunContext);

    // Assert
    expect(prepareSearchResultsUseCase.execute).toHaveBeenCalledWith(
      client,
      client.Page,
      client.Runtime,
      scrapeRunContext
    );
    expect(propertyListingPaginationService.execute).toHaveBeenCalledWith(client, scrapeRunContext);
    expect(logger.log).toHaveBeenCalledWith('SCRAPING_FOR_NEW_PROPERTIES cycle finished.');
  });

  it('whenPreparationFails_execute_shouldPropagateErrorAndSkipPaginationAndFinishLog', async () => {
    // Arrange
    const { useCase, prepareSearchResultsUseCase, propertyListingPaginationService, logger } = createUseCase();
    const client = createClient();
    const scrapeRunContext = createScrapeRunContext();
    prepareSearchResultsUseCase.execute.mockRejectedValue(new Error('prepare failed'));

    // Action
    const action = useCase.execute(client, scrapeRunContext);

    // Assert
    await expect(action).rejects.toThrow('prepare failed');
    expect(propertyListingPaginationService.execute).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('whenPaginationFails_execute_shouldPropagateErrorAndSkipFinishLog', async () => {
    // Arrange
    const { useCase, prepareSearchResultsUseCase, propertyListingPaginationService, logger } = createUseCase();
    const client = createClient();
    const scrapeRunContext = createScrapeRunContext();
    prepareSearchResultsUseCase.execute.mockResolvedValue(undefined);
    propertyListingPaginationService.execute.mockRejectedValue(new Error('pagination failed'));

    // Action
    const action = useCase.execute(client, scrapeRunContext);

    // Assert
    await expect(action).rejects.toThrow('pagination failed');
    expect(prepareSearchResultsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(propertyListingPaginationService.execute).toHaveBeenCalledTimes(1);
    expect(logger.log).not.toHaveBeenCalled();
  });
});
