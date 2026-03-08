import { describe, expect, it, jest } from '@jest/globals';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../../ports/outbound/persistence/property-persistence-port.mock';

class PropertyDetailPageServiceMock {
  readonly loadPropertyUrl = jest.fn<(client: CdpClient, url: string) => Promise<void>>();
  readonly loadPropertyUrlFromDatabase = jest.fn<(client: CdpClient, url: string) => Promise<void>>();
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

describe('PropertyListPageService', () => {
  it('whenRuntimeReturnsStringArray_getPropertyUrls_shouldReturnOnlyStringUrls', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
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
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
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
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
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

  it('whenProcessedCacheIsReset_resetProcessedUrlsForCurrentSearch_shouldAllowUrlToBeProcessedAgain', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
    const client = createClient();
    mongo.isOpenPropertyByUrl.mockResolvedValue(false);
    // Action
    await service.processUrls(client, ['https://idealista.com/inmueble/20/']);
    service.resetProcessedUrlsForCurrentSearch();
    await service.processUrls(client, ['https://idealista.com/inmueble/20/']);
    // Assert
    expect(detail.loadPropertyUrl).toHaveBeenCalledTimes(2);
  });

  it('whenUrlAppearsTwiceInCurrentCycle_processUrls_shouldProcessItOnlyOnce', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
    const client = createClient();
    mongo.isOpenPropertyByUrl.mockResolvedValue(false);
    // Action
    await service.processUrls(client, ['https://idealista.com/inmueble/1/', 'https://idealista.com/inmueble/1/']);
    // Assert
    expect(mongo.isOpenPropertyByUrl).toHaveBeenCalledTimes(1);
    expect(detail.loadPropertyUrl).toHaveBeenCalledTimes(1);
    expect(detail.loadPropertyUrl).toHaveBeenCalledWith(client, 'https://idealista.com/inmueble/1/');
  });

  it('whenUrlAlreadyExistsAsOpen_processUrls_shouldTouchLastTimeVisitedAndSkipDetailNavigation', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
    const client = createClient();
    mongo.isOpenPropertyByUrl.mockResolvedValue(true);
    // Action
    await service.processUrls(client, ['https://idealista.com/inmueble/2/']);
    // Assert
    expect(mongo.touchPropertyLastTimeVisited).toHaveBeenCalledWith('https://idealista.com/inmueble/2/');
    expect(detail.loadPropertyUrl).not.toHaveBeenCalled();
  });

  it('whenUrlIsNew_processUrls_shouldLoadDetailAndKeepProcessedCacheForLaterCalls', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
    const client = createClient();
    mongo.isOpenPropertyByUrl.mockResolvedValue(false);
    // Action
    await service.processUrls(client, ['https://idealista.com/inmueble/3/']);
    await service.processUrls(client, ['https://idealista.com/inmueble/3/']);
    // Assert
    expect(mongo.isOpenPropertyByUrl).toHaveBeenCalledTimes(1);
    expect(detail.loadPropertyUrl).toHaveBeenCalledTimes(1);
    expect(mongo.touchPropertyLastTimeVisited).not.toHaveBeenCalled();
  });

  it('whenRevalidatingExistingUrls_processExistingUrls_shouldTouchLastTimeVisitedForEachProcessedUrl', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const detail = new PropertyDetailPageServiceMock();
    const service = new PropertyListPageService(
      mongo as unknown as PropertyPersistencePort,
      detail as unknown as PropertyDetailPageService
    );
    const client = createClient();
    // Action
    await service.processExistingUrls(client, ['https://idealista.com/inmueble/4/', 'https://idealista.com/inmueble/4/']);
    // Assert
    expect(detail.loadPropertyUrlFromDatabase).toHaveBeenCalledTimes(1);
    expect(mongo.touchPropertyLastTimeVisited).toHaveBeenCalledTimes(1);
    expect(mongo.touchPropertyLastTimeVisited).toHaveBeenCalledWith('https://idealista.com/inmueble/4/');
  });
});
