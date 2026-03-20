import { describe, expect, it, jest } from '@jest/globals';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { PrepareSearchResultsUseCase } from 'src/application/usecases/scraper/prepare-search-results.use-case';

import type { FiltersCdpClient } from 'src/ports/outbound/browser/filters-cdp-client.port';
type PageDomainMock = {
  navigate(params: { url: string }): Promise<void>;
  reload(params?: { ignoreCache?: boolean }): Promise<void>;
  loadEventFired(cb: () => void): void;
};

type RuntimeDomainMock = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

class PrepareSearchResultsUseCaseMock {
  readonly execute = jest.fn<(client: FiltersCdpClient, page: PageDomainMock, runtime: RuntimeDomainMock) => Promise<void>>();
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

function createPageAndRuntime(): { page: PageDomainMock; runtime: RuntimeDomainMock } {
  return {
    page: {
      navigate: jest.fn(async () => undefined),
      reload: jest.fn(async () => undefined),
      loadEventFired: jest.fn()
    },
    runtime: {
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    }
  };
}

describe('SearchResultsPreparationService', () => {
  it('whenPreparationIsRequested_prepareSearchResultsWithFilters_shouldDelegateToPrepareSearchResultsUseCase', async () => {
    // Arrange
    const prepareSearchResultsUseCase = new PrepareSearchResultsUseCaseMock();
    prepareSearchResultsUseCase.execute.mockResolvedValue(undefined);
    const service = new SearchResultsPreparationService(
      prepareSearchResultsUseCase as unknown as PrepareSearchResultsUseCase
    );
    const client = createClient();
    const { page, runtime } = createPageAndRuntime();
    // Action
    await service.prepareSearchResultsWithFilters(client, page, runtime);
    // Assert
    expect(prepareSearchResultsUseCase.execute).toHaveBeenCalledWith(client, page, runtime);
    expect(prepareSearchResultsUseCase.execute).toHaveBeenCalledTimes(1);
  });
});

