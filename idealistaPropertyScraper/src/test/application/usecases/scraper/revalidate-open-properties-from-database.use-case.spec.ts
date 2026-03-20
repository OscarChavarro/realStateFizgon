import { describe, expect, it, jest } from '@jest/globals';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { RevalidateOpenPropertiesFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-open-properties-from-database.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

class PropertyListPageServiceMockForRevalidateOpenPropertiesFromDatabaseUseCase {
  readonly processExistingUrls = jest.fn<(client: ScraperCdpClient, urls: string[]) => Promise<void>>();
}

function createClient(): ScraperCdpClient {
  return {
    Page: {
      enable: jest.fn(async () => undefined),
      bringToFront: jest.fn(async () => undefined),
      navigate: jest.fn(async () => ({ frameId: 'frame' }))
    },
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    close: jest.fn(async () => undefined)
  } as unknown as ScraperCdpClient;
}

describe('RevalidateOpenPropertiesFromDatabaseUseCase', () => {
  it.each([
    {
      openUrls: [],
      expectedUrls: []
    },
    {
      openUrls: ['https://idealista.com/inmueble/1/', 'https://idealista.com/inmueble/2/'],
      expectedUrls: ['https://idealista.com/inmueble/1/', 'https://idealista.com/inmueble/2/']
    }
  ])('whenUseCaseRuns_execute_shouldProcessOpenUrlsLoadedFromDatabase', async ({ openUrls, expectedUrls }) => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const list = new PropertyListPageServiceMockForRevalidateOpenPropertiesFromDatabaseUseCase();
    const useCase = new RevalidateOpenPropertiesFromDatabaseUseCase(
      mongo as unknown as PropertyPersistencePort,
      list as unknown as PropertyListPageService
    );
    const client = createClient();
    mongo.getOpenPropertyUrls.mockResolvedValue(openUrls);
    list.processExistingUrls.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client);

    // Assert
    expect(mongo.getOpenPropertyUrls).toHaveBeenCalledTimes(1);
    expect(list.processExistingUrls).toHaveBeenCalledTimes(1);
    expect(list.processExistingUrls).toHaveBeenCalledWith(client, expectedUrls);
  });
});
