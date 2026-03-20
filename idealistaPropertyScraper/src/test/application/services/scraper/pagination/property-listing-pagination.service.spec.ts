import { describe, expect, it, jest } from '@jest/globals';
import { PropertyListingPaginationService } from 'application/services/scraper/pagination/property-listing-pagination.service';
import { PaginateAndProcessListingsUseCase } from 'application/usecases/scraper/paginate-and-process-listings.use-case';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
class PaginateAndProcessListingsUseCaseMock {
  readonly execute = jest.fn<(client: PropertyCdpClient) => Promise<void>>();
}

function createClient(): PropertyCdpClient {
  return {
    Runtime: {
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    Page: {
      bringToFront: jest.fn(async () => undefined)
    }
  };
}

describe('PropertyListingPaginationService', () => {
  it('whenExecuteIsRequested_execute_shouldDelegateToPaginateAndProcessListingsUseCase', async () => {
    // Arrange
    const paginateAndProcessListingsUseCase = new PaginateAndProcessListingsUseCaseMock();
    paginateAndProcessListingsUseCase.execute.mockResolvedValue(undefined);
    const service = new PropertyListingPaginationService(
      paginateAndProcessListingsUseCase as unknown as PaginateAndProcessListingsUseCase
    );
    const client = createClient();
    // Action
    await service.execute(client);
    // Assert
    expect(paginateAndProcessListingsUseCase.execute).toHaveBeenCalledWith(client);
    expect(paginateAndProcessListingsUseCase.execute).toHaveBeenCalledTimes(1);
  });
});

