import { describe, expect, it, jest } from '@jest/globals';
import { createScrapeRunContext, ScrapeRunContext } from 'application/context/scrape-run-context';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'application/usecases/scraper/process-discovered-property-urls.use-case';
import { RevalidateExistingPropertyUrlsUseCase } from 'application/usecases/scraper/revalidate-existing-property-urls.use-case';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
class ProcessDiscoveredPropertyUrlsUseCaseMockForPropertyListPageService {
  readonly execute = jest.fn<
    (client: PropertyCdpClient, urls: string[], scrapeRunContext: ScrapeRunContext) => Promise<void>
  >();
}

class RevalidateExistingPropertyUrlsUseCaseMockForPropertyListPageService {
  readonly execute = jest.fn<
    (client: PropertyCdpClient, urls: string[], scrapeRunContext: ScrapeRunContext) => Promise<void>
  >();
}

function createClient(): PropertyCdpClient {
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
    const client: PropertyCdpClient = {
      Page: {
        bringToFront: jest.fn(async () => undefined)
      },
      Runtime: {
        evaluate: jest.fn(async () => ({
          result: {
            value: [
              'https://www.idealista.com/inmueble/1/',
              'https://www.idealista.com/obra-nueva/madrid/',
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
    const client: PropertyCdpClient = {
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
    const client: PropertyCdpClient = {
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

  it('whenProcessingDiscoveredUrls_processUrls_shouldDelegateToUseCaseWithRunContext', async () => {
    // Arrange
    const { service, processDiscoveredPropertyUrlsUseCase } = createService();
    const client = createClient();
    const scrapeRunContext = createScrapeRunContext();
    const urls = ['https://idealista.com/inmueble/20/'];
    processDiscoveredPropertyUrlsUseCase.execute.mockResolvedValue(undefined);
    // Action
    await service.processUrls(client, urls, scrapeRunContext);
    // Assert
    expect(processDiscoveredPropertyUrlsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(processDiscoveredPropertyUrlsUseCase.execute).toHaveBeenCalledWith(
      client,
      urls,
      scrapeRunContext
    );
  });

  it('whenRevalidatingExistingUrls_processExistingUrls_shouldDelegateToUseCaseWithRunContext', async () => {
    // Arrange
    const { service, revalidateExistingPropertyUrlsUseCase } = createService();
    const client = createClient();
    const scrapeRunContext = createScrapeRunContext();
    const urls = ['https://idealista.com/inmueble/21/'];
    revalidateExistingPropertyUrlsUseCase.execute.mockResolvedValue(undefined);
    // Action
    await service.processExistingUrls(client, urls, scrapeRunContext);
    // Assert
    expect(revalidateExistingPropertyUrlsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(revalidateExistingPropertyUrlsUseCase.execute).toHaveBeenCalledWith(
      client,
      urls,
      scrapeRunContext
    );
  });

  it('whenCallerReusesAndClearsRunContext_processExistingUrls_shouldShareAndResetProcessedSet', async () => {
    // Arrange
    const { service, revalidateExistingPropertyUrlsUseCase } = createService();
    const client = createClient();
    const scrapeRunContext = createScrapeRunContext();
    const processedSetSizesBeforeMutation: number[] = [];
    revalidateExistingPropertyUrlsUseCase.execute.mockImplementation(async (_client, urls, context) => {
      processedSetSizesBeforeMutation.push(context.processedPropertyUrls.size);
      for (const url of urls) {
        context.processedPropertyUrls.add(url);
      }
    });
    const url = 'https://idealista.com/inmueble/22/';
    // Action
    await service.processExistingUrls(client, [url], scrapeRunContext);
    const firstSetRef = revalidateExistingPropertyUrlsUseCase.execute.mock.calls[0][2];
    scrapeRunContext.processedPropertyUrls.clear();
    await service.processExistingUrls(client, [url], scrapeRunContext);
    const secondSetRef = revalidateExistingPropertyUrlsUseCase.execute.mock.calls[1][2];
    // Assert
    expect(firstSetRef).toBe(secondSetRef);
    expect(processedSetSizesBeforeMutation).toEqual([0, 0]);
    expect(secondSetRef.processedPropertyUrls.size).toBe(1);
  });
});
