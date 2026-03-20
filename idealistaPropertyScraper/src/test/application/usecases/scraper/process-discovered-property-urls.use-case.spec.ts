import { describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'application/usecases/scraper/process-discovered-property-urls.use-case';
import { PropertyPersistencePort } from 'ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
class PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase {
  readonly loadPropertyUrl = jest.fn<(client: PropertyCdpClient, url: string) => Promise<void>>();
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
      propertyPersistencePort as unknown as PropertyPersistencePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const processedUrls = new Set<string>(['https://idealista.com/inmueble/1/']);
    // Action
    await useCase.execute(createClient(), ['https://idealista.com/inmueble/1/'], processedUrls);
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
      propertyPersistencePort as unknown as PropertyPersistencePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const url = 'https://idealista.com/inmueble/2/';
    const processedUrls = new Set<string>();
    // Action
    await useCase.execute(createClient(), [url], processedUrls);
    // Assert
    expect(propertyPersistencePort.isOpenPropertyByUrl).toHaveBeenCalledWith(url);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).toHaveBeenCalledWith(url);
    expect(propertyDetailPageService.loadPropertyUrl).not.toHaveBeenCalled();
    expect(processedUrls.has(url)).toBe(false);
  });

  it('whenUrlIsNew_execute_shouldNavigateAndMarkUrlAsProcessed', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.isOpenPropertyByUrl.mockResolvedValue(false);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase();
    propertyDetailPageService.loadPropertyUrl.mockResolvedValue(undefined);
    const useCase = new ProcessDiscoveredPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/3/';
    const processedUrls = new Set<string>();
    // Action
    await useCase.execute(client, [url], processedUrls);
    // Assert
    expect(propertyPersistencePort.isOpenPropertyByUrl).toHaveBeenCalledWith(url);
    expect(propertyDetailPageService.loadPropertyUrl).toHaveBeenCalledWith(client, url);
    expect(propertyPersistencePort.touchPropertyLastTimeVisited).not.toHaveBeenCalled();
    expect(processedUrls.has(url)).toBe(true);
  });

  it('whenUrlAppearsTwice_execute_shouldProcessItOnlyOnce', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.isOpenPropertyByUrl.mockResolvedValue(false);
    const propertyDetailPageService = new PropertyDetailPageServiceMockForProcessDiscoveredPropertyUrlsUseCase();
    propertyDetailPageService.loadPropertyUrl.mockResolvedValue(undefined);
    const useCase = new ProcessDiscoveredPropertyUrlsUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort,
      propertyDetailPageService as unknown as PropertyDetailPageService
    );
    const client = createClient();
    const url = 'https://idealista.com/inmueble/4/';
    const processedUrls = new Set<string>();
    // Action
    await useCase.execute(client, [url, url], processedUrls);
    // Assert
    expect(propertyPersistencePort.isOpenPropertyByUrl).toHaveBeenCalledTimes(1);
    expect(propertyDetailPageService.loadPropertyUrl).toHaveBeenCalledTimes(1);
    expect(processedUrls.has(url)).toBe(true);
  });
});
