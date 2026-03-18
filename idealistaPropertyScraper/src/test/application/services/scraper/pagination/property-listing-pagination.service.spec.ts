import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyListingPaginationService } from 'src/application/services/scraper/pagination/property-listing-pagination.service';
import { PaginateAndProcessListingsUseCase } from 'src/application/usecases/paginate-and-process-listings.use-case';

class PaginateAndProcessListingsUseCaseMock {
  readonly execute = jest.fn<(client: CdpClient) => Promise<void>>();
}

function createClient(): CdpClient {
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

