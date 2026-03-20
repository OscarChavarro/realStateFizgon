import { describe, expect, it, jest } from '@jest/globals';
import { ApplySearchFiltersUseCase } from 'src/application/usecases/scraper/apply-search-filters.use-case';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';

import type { FiltersCdpClient } from 'src/ports/outbound/browser/filters-cdp-client.port';
class ApplySearchFiltersUseCaseMock {
  readonly execute = jest.fn<(client: FiltersCdpClient) => Promise<void>>();
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

describe('FiltersService', () => {
  it('whenExecuteIsRequested_execute_shouldDelegateToApplySearchFiltersUseCase', async () => {
    // Arrange
    const applySearchFiltersUseCase = new ApplySearchFiltersUseCaseMock();
    applySearchFiltersUseCase.execute.mockResolvedValue(undefined);
    const service = new FiltersService(applySearchFiltersUseCase as unknown as ApplySearchFiltersUseCase);
    const client = createClient();
    // Action
    await service.execute(client);
    // Assert
    expect(applySearchFiltersUseCase.execute).toHaveBeenCalledWith(client);
    expect(applySearchFiltersUseCase.execute).toHaveBeenCalledTimes(1);
  });
});

