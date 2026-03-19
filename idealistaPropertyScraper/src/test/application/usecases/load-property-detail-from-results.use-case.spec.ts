import { describe, expect, it, jest } from '@jest/globals';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';
import { LoadPropertyDetailFromResultsUseCase } from 'src/application/usecases/load-property-detail-from-results.use-case';

class PropertyDetailNavigationServiceMockForLoadPropertyDetailFromResultsUseCase {
  readonly clickPropertyLinkFromResults = jest.fn<(runtime: unknown, targetUrl: string) => Promise<boolean>>();
  readonly waitForDetailUrlAndDomComplete = jest.fn<(runtime: unknown, targetUrl: string) => Promise<void>>();
  readonly goBackToSearchResults = jest.fn<(runtime: unknown) => Promise<void>>();
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

describe('LoadPropertyDetailFromResultsUseCase', () => {
  it('whenLinkIsNotVisible_execute_shouldThrowAndSkipBackNavigation', async () => {
    // Arrange
    const navigationService = new PropertyDetailNavigationServiceMockForLoadPropertyDetailFromResultsUseCase();
    navigationService.clickPropertyLinkFromResults.mockResolvedValue(false);
    const useCase = new LoadPropertyDetailFromResultsUseCase(
      navigationService as unknown as PropertyDetailNavigationService
    );
    // Action
    const action = useCase.execute(createClient(), 'https://www.idealista.com/inmueble/1/', async () => undefined);
    // Assert
    await expect(action).rejects.toThrow(
      'Property URL is not visible in current results DOM and cannot be clicked: https://www.idealista.com/inmueble/1/'
    );
    expect(navigationService.waitForDetailUrlAndDomComplete).not.toHaveBeenCalled();
    expect(navigationService.goBackToSearchResults).not.toHaveBeenCalled();
  });

  it('whenClickAndWaitSucceed_execute_shouldRunCallbackAndGoBack', async () => {
    // Arrange
    const navigationService = new PropertyDetailNavigationServiceMockForLoadPropertyDetailFromResultsUseCase();
    navigationService.clickPropertyLinkFromResults.mockResolvedValue(true);
    navigationService.waitForDetailUrlAndDomComplete.mockResolvedValue(undefined);
    navigationService.goBackToSearchResults.mockResolvedValue(undefined);
    const useCase = new LoadPropertyDetailFromResultsUseCase(
      navigationService as unknown as PropertyDetailNavigationService
    );
    const client = createClient();
    const callback = jest.fn<() => Promise<void>>(async () => undefined);
    const url = 'https://www.idealista.com/inmueble/2/';
    // Action
    await useCase.execute(client, url, callback);
    // Assert
    expect(navigationService.waitForDetailUrlAndDomComplete).toHaveBeenCalledWith(client.Runtime, url);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(navigationService.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });

  it('whenWaitFails_execute_shouldGoBackAndPropagateError', async () => {
    // Arrange
    const navigationService = new PropertyDetailNavigationServiceMockForLoadPropertyDetailFromResultsUseCase();
    navigationService.clickPropertyLinkFromResults.mockResolvedValue(true);
    navigationService.waitForDetailUrlAndDomComplete.mockRejectedValue(new Error('wait failed'));
    navigationService.goBackToSearchResults.mockResolvedValue(undefined);
    const useCase = new LoadPropertyDetailFromResultsUseCase(
      navigationService as unknown as PropertyDetailNavigationService
    );
    const callback = jest.fn<() => Promise<void>>(async () => undefined);
    // Action
    const action = useCase.execute(createClient(), 'https://www.idealista.com/inmueble/3/', callback);
    // Assert
    await expect(action).rejects.toThrow('wait failed');
    expect(callback).not.toHaveBeenCalled();
    expect(navigationService.goBackToSearchResults).toHaveBeenCalledTimes(1);
  });

  it('whenCallbackFails_execute_shouldGoBackAndPropagateError', async () => {
    // Arrange
    const navigationService = new PropertyDetailNavigationServiceMockForLoadPropertyDetailFromResultsUseCase();
    navigationService.clickPropertyLinkFromResults.mockResolvedValue(true);
    navigationService.waitForDetailUrlAndDomComplete.mockResolvedValue(undefined);
    navigationService.goBackToSearchResults.mockResolvedValue(undefined);
    const useCase = new LoadPropertyDetailFromResultsUseCase(
      navigationService as unknown as PropertyDetailNavigationService
    );
    const callback = jest.fn<() => Promise<void>>(async () => {
      throw new Error('callback failed');
    });
    // Action
    const action = useCase.execute(createClient(), 'https://www.idealista.com/inmueble/4/', callback);
    // Assert
    await expect(action).rejects.toThrow('callback failed');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(navigationService.goBackToSearchResults).toHaveBeenCalledTimes(1);
  });
});
