import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'src/application/usecases/process-discovered-property-urls.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../../ports/outbound/persistence/property-persistence-port.mock';

class PropertyDetailPageServiceMockForPropertyListPageService {
  readonly loadPropertyUrl = jest.fn<(client: CdpClient, url: string) => Promise<void>>();
  readonly loadPropertyUrlFromDatabase = jest.fn<(client: CdpClient, url: string) => Promise<void>>();
}

class ProcessDiscoveredPropertyUrlsUseCaseMockForPropertyListPageService {
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
  const propertyPersistencePort = new PropertyPersistencePortMock();
  const propertyDetailPageService = new PropertyDetailPageServiceMockForPropertyListPageService();
  const processDiscoveredPropertyUrlsUseCase = new ProcessDiscoveredPropertyUrlsUseCaseMockForPropertyListPageService();
  const service = new PropertyListPageService(
    propertyPersistencePort as unknown as PropertyPersistencePort,
    propertyDetailPageService as unknown as PropertyDetailPageService,
    processDiscoveredPropertyUrlsUseCase as unknown as ProcessDiscoveredPropertyUrlsUseCase
  );

  return {
    service,
    propertyPersistencePort,
    propertyDetailPageService,
    processDiscoveredPropertyUrlsUseCase
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

  it('whenProcessedCacheIsReset_resetProcessedUrlsForCurrentSearch_shouldAllowExistingUrlToBeRevalidatedAgain', async () => {
    // Arrange
    const { service, propertyDetailPageService, propertyPersistencePort } = createService();
    const client = createClient();
    propertyDetailPageService.loadPropertyUrlFromDatabase.mockResolvedValue(undefined);
    propertyPersistencePort.touchPropertyLastTimeVisited.mockResolvedValue(undefined);
    const url = 'https://idealista.com/inmueble/20/';
    // Action
    await service.processExistingUrls(client, [url]);
    service.resetProcessedUrlsForCurrentSearch();
    await service.processExistingUrls(client, [url]);
    // Assert
    expect(propertyDetailPageService.loadPropertyUrlFromDatabase).toHaveBeenCalledTimes(2);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledTimes(2);
  });

  it('whenRevalidatingExistingUrls_processExistingUrls_shouldTouchLastTimeVisitedOnlyOnceForDuplicatedUrl', async () => {
    // Arrange
    const { service, propertyDetailPageService, propertyPersistencePort } = createService();
    const client = createClient();
    propertyDetailPageService.loadPropertyUrlFromDatabase.mockResolvedValue(undefined);
    propertyPersistencePort.touchPropertyLastTimeVisited.mockResolvedValue(undefined);
    const url = 'https://idealista.com/inmueble/4/';
    // Action
    await service.processExistingUrls(client, [url, url]);
    // Assert
    expect(propertyDetailPageService.loadPropertyUrlFromDatabase).toHaveBeenCalledTimes(1);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledTimes(1);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledWith(url);
  });
});
