import { describe, expect, it, jest } from '@jest/globals';
import { PropertyListingPaginationService } from 'application/services/scraper/pagination/property-listing-pagination.service';
import { SearchResultsPreparationService } from 'application/services/scraper/search-results-preparation.service';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'application/usecases/scraper/execute-scrape-new-properties-flow.use-case';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
class SearchResultsPreparationServiceMockForExecuteScrapeNewPropertiesFlowUseCase {
  readonly prepareSearchResultsWithFilters = jest.fn<
    (client: ScraperCdpClient, page: ScraperCdpClient['Page'], runtime: ScraperCdpClient['Runtime']) => Promise<void>
  >();
}

class PropertyListingPaginationServiceMockForExecuteScrapeNewPropertiesFlowUseCase {
  readonly execute = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
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
  const searchResultsPreparationService = new SearchResultsPreparationServiceMockForExecuteScrapeNewPropertiesFlowUseCase();
  const propertyListingPaginationService = new PropertyListingPaginationServiceMockForExecuteScrapeNewPropertiesFlowUseCase();
  const useCase = new ExecuteScrapeNewPropertiesFlowUseCase(
    searchResultsPreparationService as unknown as SearchResultsPreparationService,
    propertyListingPaginationService as unknown as PropertyListingPaginationService
  );
  const logger = {
    log: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;

  return {
    useCase,
    searchResultsPreparationService,
    propertyListingPaginationService,
    logger
  };
}

describe('ExecuteScrapeNewPropertiesFlowUseCase', () => {
  it('whenPreparationAndPaginationSucceed_execute_shouldRunFlowAndLogFinish', async () => {
    // Arrange
    const { useCase, searchResultsPreparationService, propertyListingPaginationService, logger } = createUseCase();
    const client = createClient();
    searchResultsPreparationService.prepareSearchResultsWithFilters.mockResolvedValue(undefined);
    propertyListingPaginationService.execute.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client);

    // Assert
    expect(searchResultsPreparationService.prepareSearchResultsWithFilters).toHaveBeenCalledWith(
      client,
      client.Page,
      client.Runtime
    );
    expect(propertyListingPaginationService.execute).toHaveBeenCalledWith(client);
    expect(logger.log).toHaveBeenCalledWith('SCRAPING_FOR_NEW_PROPERTIES cycle finished.');
  });

  it('whenPreparationFails_execute_shouldPropagateErrorAndSkipPaginationAndFinishLog', async () => {
    // Arrange
    const { useCase, searchResultsPreparationService, propertyListingPaginationService, logger } = createUseCase();
    const client = createClient();
    searchResultsPreparationService.prepareSearchResultsWithFilters.mockRejectedValue(new Error('prepare failed'));

    // Action
    const action = useCase.execute(client);

    // Assert
    await expect(action).rejects.toThrow('prepare failed');
    expect(propertyListingPaginationService.execute).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('whenPaginationFails_execute_shouldPropagateErrorAndSkipFinishLog', async () => {
    // Arrange
    const { useCase, searchResultsPreparationService, propertyListingPaginationService, logger } = createUseCase();
    const client = createClient();
    searchResultsPreparationService.prepareSearchResultsWithFilters.mockResolvedValue(undefined);
    propertyListingPaginationService.execute.mockRejectedValue(new Error('pagination failed'));

    // Action
    const action = useCase.execute(client);

    // Assert
    await expect(action).rejects.toThrow('pagination failed');
    expect(searchResultsPreparationService.prepareSearchResultsWithFilters).toHaveBeenCalledTimes(1);
    expect(propertyListingPaginationService.execute).toHaveBeenCalledTimes(1);
    expect(logger.log).not.toHaveBeenCalled();
  });
});
