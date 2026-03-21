import { describe, expect, it, jest } from '@jest/globals';
import { createScrapeRunContext, ScrapeRunContext } from 'application/context/scrape-run-context';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { RevalidateExistingPropertyUrlsUseCase } from 'application/usecases/scraper/revalidate-existing-property-urls.use-case';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
class PropertyDetailPageServiceMockForRevalidateExistingPropertyUrlsUseCase {
  readonly loadPropertyUrlFromDatabase = jest.fn<
    (client: PropertyCdpClient, url: string, scrapeRunContext: ScrapeRunContext) => Promise<void>
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

describe('RevalidateExistingPropertyUrlsUseCase', () => {
  it('whenUrlWasAlreadyProcessed_execute_shouldSkipDatabaseRevalidationAndTouch', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    const propertyDetailPageService = new PropertyDetailPageServiceMockForRevalidateExistingPropertyUrlsUseCase();
    const useCase = new RevalidateExistingPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyWritePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.processedPropertyUrls.add('https://idealista.com/inmueble/1/');
    // Action
    await useCase.execute(createClient(), ['https://idealista.com/inmueble/1/'], scrapeRunContext);
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
      propertyPersistencePort as unknown as PropertyWritePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/2/';
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(client, [url], scrapeRunContext);
    // Assert
    expect(propertyDetailPageService.loadPropertyUrlFromDatabase).toHaveBeenCalledWith(client, url, scrapeRunContext);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledWith(url);
    expect(scrapeRunContext.processedPropertyUrls.has(url)).toBe(true);
  });

  it('whenSameUrlAppearsTwice_execute_shouldRevalidateOnlyOnce', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.touchPropertyLastTimeVisited.mockResolvedValue(undefined);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForRevalidateExistingPropertyUrlsUseCase();
    propertyDetailPageService.loadPropertyUrlFromDatabase.mockResolvedValue(undefined);
    const useCase = new RevalidateExistingPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyWritePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/3/';
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(client, [url, url], scrapeRunContext);
    // Assert
    expect(propertyDetailPageService.loadPropertyUrlFromDatabase).toHaveBeenCalledTimes(1);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledTimes(1);
    expect(scrapeRunContext.processedPropertyUrls.has(url)).toBe(true);
  });
});
