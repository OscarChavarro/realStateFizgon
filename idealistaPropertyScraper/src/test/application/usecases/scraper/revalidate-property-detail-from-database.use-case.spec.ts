import { describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';
import { RevalidatePropertyDetailFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-property-detail-from-database.use-case';

import type { PropertyCdpClient } from 'src/application/services/scraper/property/cdp-client.type';
class PropertyDetailNavigationServiceMockForRevalidatePropertyDetailFromDatabaseUseCase {
  readonly navigateDirectlyToUrl = jest.fn<(runtime: unknown, targetUrl: string) => Promise<void>>();
  readonly goBackToSearchResults = jest.fn<(runtime: unknown) => Promise<void>>();
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

describe('RevalidatePropertyDetailFromDatabaseUseCase', () => {
  it('whenNavigationAndCallbackSucceed_execute_shouldNavigateRunCallbackAndReturnToSearchResults', async () => {
    // Arrange
    const navigationService = new PropertyDetailNavigationServiceMockForRevalidatePropertyDetailFromDatabaseUseCase();
    navigationService.navigateDirectlyToUrl.mockResolvedValue(undefined);
    navigationService.goBackToSearchResults.mockResolvedValue(undefined);
    const useCase = new RevalidatePropertyDetailFromDatabaseUseCase(
      navigationService as unknown as PropertyDetailNavigationService
    );
    const client = createClient();
    const callback = jest.fn<() => Promise<void>>(async () => undefined);
    const url = 'https://www.idealista.com/inmueble/1/';
    // Action
    await useCase.execute(client, url, callback);
    // Assert
    expect(navigationService.navigateDirectlyToUrl).toHaveBeenCalledWith(client.Runtime, url);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(navigationService.goBackToSearchResults).toHaveBeenCalledWith(client.Runtime);
  });

  it('whenNavigationFails_execute_shouldGoBackAndPropagateErrorWithoutCallingCallback', async () => {
    // Arrange
    const navigationService = new PropertyDetailNavigationServiceMockForRevalidatePropertyDetailFromDatabaseUseCase();
    navigationService.navigateDirectlyToUrl.mockRejectedValue(new Error('navigation failed'));
    navigationService.goBackToSearchResults.mockResolvedValue(undefined);
    const useCase = new RevalidatePropertyDetailFromDatabaseUseCase(
      navigationService as unknown as PropertyDetailNavigationService
    );
    const callback = jest.fn<() => Promise<void>>(async () => undefined);
    // Action
    const action = useCase.execute(createClient(), 'https://www.idealista.com/inmueble/2/', callback);
    // Assert
    await expect(action).rejects.toThrow('navigation failed');
    expect(callback).not.toHaveBeenCalled();
    expect(navigationService.goBackToSearchResults).toHaveBeenCalledTimes(1);
  });

  it('whenCallbackFails_execute_shouldGoBackAndPropagateError', async () => {
    // Arrange
    const navigationService = new PropertyDetailNavigationServiceMockForRevalidatePropertyDetailFromDatabaseUseCase();
    navigationService.navigateDirectlyToUrl.mockResolvedValue(undefined);
    navigationService.goBackToSearchResults.mockResolvedValue(undefined);
    const useCase = new RevalidatePropertyDetailFromDatabaseUseCase(
      navigationService as unknown as PropertyDetailNavigationService
    );
    const callback = jest.fn<() => Promise<void>>(async () => {
      throw new Error('callback failed');
    });
    // Action
    const action = useCase.execute(createClient(), 'https://www.idealista.com/inmueble/3/', callback);
    // Assert
    await expect(action).rejects.toThrow('callback failed');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(navigationService.goBackToSearchResults).toHaveBeenCalledTimes(1);
  });
});
