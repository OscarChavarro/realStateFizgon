import { describe, expect, it, jest } from '@jest/globals';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'application/usecases/scraper/revalidate-properties-without-last-visit.use-case';
import { PropertyPersistencePort } from 'ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
class PropertyListPageServiceMockForRevalidatePropertiesWithoutLastVisitUseCase {
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

describe('RevalidatePropertiesWithoutLastVisitUseCase', () => {
  it.each([
    {
      missingUrls: [],
      expectedCalls: 0
    },
    {
      missingUrls: ['https://idealista.com/inmueble/1/'],
      expectedCalls: 1
    }
  ])('whenUseCaseRuns_execute_shouldOnlyProcessUrlsWhenThereAreMissingVisits', async ({ missingUrls, expectedCalls }) => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const list = new PropertyListPageServiceMockForRevalidatePropertiesWithoutLastVisitUseCase();
    const useCase = new RevalidatePropertiesWithoutLastVisitUseCase(
      mongo as unknown as PropertyPersistencePort,
      list as unknown as PropertyListPageService
    );
    const client = createClient();
    mongo.getOpenPropertyUrlsWithoutLastTimeVisited.mockResolvedValue(missingUrls);
    list.processExistingUrls.mockResolvedValue(undefined);

    // Action
    await useCase.execute(client);

    // Assert
    expect(mongo.getOpenPropertyUrlsWithoutLastTimeVisited).toHaveBeenCalledTimes(1);
    expect(list.processExistingUrls).toHaveBeenCalledTimes(expectedCalls);
    if (expectedCalls > 0) {
      expect(list.processExistingUrls).toHaveBeenCalledWith(client, missingUrls);
    }
  });
});
