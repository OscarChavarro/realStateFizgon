import { describe, expect, it, jest } from '@jest/globals';
import { createScrapeRunContext, ScrapeRunContext } from 'application/context/scrape-run-context';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'application/usecases/scraper/process-discovered-property-urls.use-case';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
class PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase {
  readonly loadPropertyUrl = jest.fn<
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

describe('ProcessDiscoveredPropertyUrlsUseCase', () => {
  it('whenUrlWasAlreadyProcessed_execute_shouldSkipPersistenceCheckAndNavigation', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    const propertyDetailPageService = new PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase();
    const useCase = new ProcessDiscoveredPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyReadPort,
      propertyPersistencePort as unknown as PropertyWritePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.processedPropertyUrls.add('https://idealista.com/inmueble/1/');
    // Action
    await useCase.execute(createClient(), ['https://idealista.com/inmueble/1/'], scrapeRunContext);
    // Assert
    expect(propertyPersistencePort.isOpenPropertyByUrl).not.toHaveBeenCalled();
    expect(propertyDetailPageService.loadPropertyUrl).not.toHaveBeenCalled();
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).not.toHaveBeenCalled();
  });

  it('whenUrlIsAlreadyOpen_execute_shouldTouchLastTimeVisitedAndSkipNavigation', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.isOpenPropertyByUrl.mockResolvedValue(true);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase();
    const useCase = new ProcessDiscoveredPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyReadPort,
      propertyPersistencePort as unknown as PropertyWritePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const url = 'https://idealista.com/inmueble/2/';
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(createClient(), [url], scrapeRunContext);
    // Assert
    expect(propertyPersistencePort.isOpenPropertyByUrl).toHaveBeenCalledWith(url);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledWith(url);
    expect(propertyDetailPageService.loadPropertyUrl).not.toHaveBeenCalled();
    expect(scrapeRunContext.processedPropertyUrls.has(url)).toBe(false);
  });

  it('whenUrlIsNew_execute_shouldNavigateAndMarkUrlAsProcessed', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.isOpenPropertyByUrl.mockResolvedValue(false);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase();
    propertyDetailPageService.loadPropertyUrl.mockResolvedValue(undefined);
    const useCase = new ProcessDiscoveredPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyReadPort,
      propertyPersistencePort as unknown as PropertyWritePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/3/';
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(client, [url], scrapeRunContext);
    // Assert
    expect(propertyPersistencePort.isOpenPropertyByUrl).toHaveBeenCalledWith(url);
    expect(propertyDetailPageService.loadPropertyUrl).toHaveBeenCalledWith(client, url, scrapeRunContext);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).not.toHaveBeenCalled();
    expect(scrapeRunContext.processedPropertyUrls.has(url)).toBe(true);
  });

  it('whenUrlAppearsTwice_execute_shouldProcessItOnlyOnce', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.isOpenPropertyByUrl.mockResolvedValue(false);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase();
    propertyDetailPageService.loadPropertyUrl.mockResolvedValue(undefined);
    const useCase = new ProcessDiscoveredPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyReadPort,
      propertyPersistencePort as unknown as PropertyWritePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/4/';
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(client, [url, url], scrapeRunContext);
    // Assert
    expect(propertyPersistencePort.isOpenPropertyByUrl).toHaveBeenCalledTimes(1);
    expect(propertyDetailPageService.loadPropertyUrl).toHaveBeenCalledTimes(1);
    expect(scrapeRunContext.processedPropertyUrls.has(url)).toBe(true);
  });
});
