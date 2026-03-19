import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'src/application/usecases/process-discovered-property-urls.use-case';
import { RevalidateExistingPropertyUrlsUseCase } from 'src/application/usecases/revalidate-existing-property-urls.use-case';

class ProcessDiscoveredPropertyUrlsUseCaseMockForPropertyListPageService {
  readonly execute = jest.fn<(client: CdpClient, urls: string[], processedUrls: Set<string>) => Promise<void>>();
}

class RevalidateExistingPropertyUrlsUseCaseMockForPropertyListPageService {
  readonly execute = jest.fn<(client: CdpClient, urls: string[], processedUrls: Set<string>) => Promise<void>>();
}

function createClient(): CdpClient {
  return {
    Page: {
      bringToFront: jest.fn(async () => undefined)
    },
    Runtime: {
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    }
  };
}

function createService() {
  const processDiscoveredPropertyUrlsUseCase = new ProcessDiscoveredPropertyUrlsUseCaseMockForPropertyListPageService();
  const revalidateExistingPropertyUrlsUseCase = new RevalidateExistingPropertyUrlsUseCaseMockForPropertyListPageService();
  const service = new PropertyListPageService(
    processDiscoveredPropertyUrlsUseCase as unknown as ProcessDiscoveredPropertyUrlsUseCase,
    revalidateExistingPropertyUrlsUseCase as unknown as RevalidateExistingPropertyUrlsUseCase
  );

  return {
    service,
    processDiscoveredPropertyUrlsUseCase,
    revalidateExistingPropertyUrlsUseCase
  };
}

describe('PropertyListPageService', () => {
  it('whenRuntimeReturnsStringArray_getPropertyUrls_shouldReturnOnlyStringUrls', async () => {
    // Arrange
    const { service } = createService();
    const client: CdpClient = {
      Page: {
        bringToFront: jest.fn(async () => undefined)
      },
      Runtime: {
        evaluate: jest.fn(async () => ({
          result: {
            value: [
              'https://www.idealista.com/inmueble/1/',
              5,
              'https://www.idealista.com/inmueble/2/'
            ]
          }
        }))
      }
    };
    // Action
    const urls = await service.getPropertyUrls(client);
    // Assert
    expect(urls).toEqual([
      'https://www.idealista.com/inmueble/1/',
      'https://www.idealista.com/inmueble/2/'
    ]);
  });

  it('whenRuntimeReturnsException_getPropertyUrls_shouldThrowError', async () => {
    // Arrange
    const { service } = createService();
    const client: CdpClient = {
      Page: {
        bringToFront: jest.fn(async () => undefined)
      },
      Runtime: {
        evaluate: jest.fn(async () => ({
          exceptionDetails: { text: 'runtime-error' }
        }))
      }
    };
    // Action
    const action = service.getPropertyUrls(client);
    // Assert
    await expect(action).rejects.toThrow('runtime-error');
  });

  it('whenRuntimeReturnsNonArray_getPropertyUrls_shouldReturnEmptyArray', async () => {
    // Arrange
    const { service } = createService();
    const client: CdpClient = {
      Page: {
        bringToFront: jest.fn(async () => undefined)
      },
      Runtime: {
        evaluate: jest.fn(async () => ({
          result: {
            value: {
              invalid: true
            }
          }
        }))
      }
    };
    // Action
    const urls = await service.getPropertyUrls(client);
    // Assert
    expect(urls).toEqual([]);
  });

  it('whenProcessingDiscoveredUrls_processUrls_shouldDelegateToUseCaseWithInternalProcessedSet', async () => {
    // Arrange
    const { service, processDiscoveredPropertyUrlsUseCase } = createService();
    const client = createClient();
    const urls = ['https://idealista.com/inmueble/20/'];
    processDiscoveredPropertyUrlsUseCase.execute.mockResolvedValue(undefined);
    // Action
    await service.processUrls(client, urls);
    // Assert
    expect(processDiscoveredPropertyUrlsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(processDiscoveredPropertyUrlsUseCase.execute).toHaveBeenCalledWith(
      client,
      urls,
      expect.any(Set)
    );
  });

  it('whenRevalidatingExistingUrls_processExistingUrls_shouldDelegateToUseCaseWithInternalProcessedSet', async () => {
    // Arrange
    const { service, revalidateExistingPropertyUrlsUseCase } = createService();
    const client = createClient();
    const urls = ['https://idealista.com/inmueble/21/'];
    revalidateExistingPropertyUrlsUseCase.execute.mockResolvedValue(undefined);
    // Action
    await service.processExistingUrls(client, urls);
    // Assert
    expect(revalidateExistingPropertyUrlsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(revalidateExistingPropertyUrlsUseCase.execute).toHaveBeenCalledWith(
      client,
      urls,
      expect.any(Set)
    );
  });

  it('whenProcessedCacheIsReset_resetProcessedUrlsForCurrentSearch_shouldClearSharedProcessedSetInstance', async () => {
    // Arrange
    const { service, revalidateExistingPropertyUrlsUseCase } = createService();
    const client = createClient();
    const processedSetSizesBeforeMutation: number[] = [];
    revalidateExistingPropertyUrlsUseCase.execute.mockImplementation(async (_client, urls, processedUrls) => {
      processedSetSizesBeforeMutation.push(processedUrls.size);
      for (const url of urls) {
        processedUrls.add(url);
      }
    });
    const url = 'https://idealista.com/inmueble/22/';
    // Action
    await service.processExistingUrls(client, [url]);
    const firstSetRef = revalidateExistingPropertyUrlsUseCase.execute.mock.calls[0][2];
    service.resetProcessedUrlsForCurrentSearch();
    await service.processExistingUrls(client, [url]);
    const secondSetRef = revalidateExistingPropertyUrlsUseCase.execute.mock.calls[1][2];
    // Assert
    expect(firstSetRef).toBe(secondSetRef);
    expect(processedSetSizesBeforeMutation).toEqual([0, 0]);
    expect(secondSetRef.size).toBe(1);
  });
});
