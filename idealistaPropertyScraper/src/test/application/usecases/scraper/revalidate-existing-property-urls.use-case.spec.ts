import { describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { RevalidateExistingPropertyUrlsUseCase } from 'src/application/usecases/scraper/revalidate-existing-property-urls.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

import type { PropertyCdpClient } from 'src/application/services/scraper/property/cdp-client.type';
class PropertyDetailPageServiceMockForRevalidateExistingPropertyUrlsUseCase {
  readonly loadPropertyUrlFromDatabase = jest.fn<(client: PropertyCdpClient, url: string) => Promise<void>>();
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

describe('RevalidateExistingPropertyUrlsUseCase', () => {
  it('whenUrlWasAlreadyProcessed_execute_shouldSkipDatabaseRevalidationAndTouch', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    const propertyDetailPageService = new PropertyDetailPageServiceMockForRevalidateExistingPropertyUrlsUseCase();
    const useCase = new RevalidateExistingPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const processedUrls = new Set<string>(['https://idealista.com/inmueble/1/']);
    // Action
    await useCase.execute(createClient(), ['https://idealista.com/inmueble/1/'], processedUrls);
    // Assert
    expect(propertyDetailPageService.loadPropertyUrlFromDatabase).not.toHaveBeenCalled();
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).not.toHaveBeenCalled();
  });

  it('whenUrlIsNotProcessed_execute_shouldRevalidateAndTouchAndMarkAsProcessed', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.touchPropertyLastTimeVisited.mockResolvedValue(undefined);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForRevalidateExistingPropertyUrlsUseCase();
    propertyDetailPageService.loadPropertyUrlFromDatabase.mockResolvedValue(undefined);
    const useCase = new RevalidateExistingPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/2/';
    const processedUrls = new Set<string>();
    // Action
    await useCase.execute(client, [url], processedUrls);
    // Assert
    expect(propertyDetailPageService.loadPropertyUrlFromDatabase).toHaveBeenCalledWith(client, url);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledWith(url);
    expect(processedUrls.has(url)).toBe(true);
  });

  it('whenSameUrlAppearsTwice_execute_shouldRevalidateOnlyOnce', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.touchPropertyLastTimeVisited.mockResolvedValue(undefined);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForRevalidateExistingPropertyUrlsUseCase();
    propertyDetailPageService.loadPropertyUrlFromDatabase.mockResolvedValue(undefined);
    const useCase = new RevalidateExistingPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/3/';
    const processedUrls = new Set<string>();
    // Action
    await useCase.execute(client, [url, url], processedUrls);
    // Assert
    expect(propertyDetailPageService.loadPropertyUrlFromDatabase).toHaveBeenCalledTimes(1);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledTimes(1);
    expect(processedUrls.has(url)).toBe(true);
  });
});
