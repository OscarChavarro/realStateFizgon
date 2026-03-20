import { describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { LoadPropertyDetailFromResultsUseCase } from 'application/usecases/scraper/load-property-detail-from-results.use-case';
import { ProcessLoadedPropertyDetailUseCase } from 'application/usecases/scraper/process-loaded-property-detail.use-case';
import { RevalidatePropertyDetailFromDatabaseUseCase } from 'application/usecases/scraper/revalidate-property-detail-from-database.use-case';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
class LoadPropertyDetailFromResultsUseCaseMockForPropertyDetailPageService {
  readonly execute = jest.fn<(client: PropertyCdpClient, url: string, onDetailLoaded: () => Promise<void>) => Promise<void>>();
}

class RevalidatePropertyDetailFromDatabaseUseCaseMockForPropertyDetailPageService {
  readonly execute = jest.fn<(client: PropertyCdpClient, url: string, onDetailLoaded: () => Promise<void>) => Promise<void>>();
}

class ProcessLoadedPropertyDetailUseCaseMockForPropertyDetailPageService {
  readonly execute = jest.fn<
    (client: PropertyCdpClient, url: string, mode: 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB') => Promise<void>
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

function createService() {
  const loadPropertyDetailFromResultsUseCase = new LoadPropertyDetailFromResultsUseCaseMockForPropertyDetailPageService();
  const revalidatePropertyDetailFromDatabaseUseCase =
    new RevalidatePropertyDetailFromDatabaseUseCaseMockForPropertyDetailPageService();
  const processLoadedPropertyDetailUseCase = new ProcessLoadedPropertyDetailUseCaseMockForPropertyDetailPageService();

  const service = new PropertyDetailPageService(
    loadPropertyDetailFromResultsUseCase as unknown as LoadPropertyDetailFromResultsUseCase,
    revalidatePropertyDetailFromDatabaseUseCase as unknown as RevalidatePropertyDetailFromDatabaseUseCase,
    processLoadedPropertyDetailUseCase as unknown as ProcessLoadedPropertyDetailUseCase
  );

  return {
    service,
    loadPropertyDetailFromResultsUseCase,
    revalidatePropertyDetailFromDatabaseUseCase,
    processLoadedPropertyDetailUseCase
  };
}

describe('PropertyDetailPageService', () => {
  it('whenLoadingFromResultsFails_loadPropertyUrl_shouldPropagateErrorFromUseCase', async () => {
    // Arrange
    const { service, loadPropertyDetailFromResultsUseCase } = createService();
    const client = createClient();
    loadPropertyDetailFromResultsUseCase.execute.mockRejectedValue(
      new Error('Property URL is not visible in current results DOM and cannot be clicked: https://www.idealista.com/inmueble/1/')
    );

    // Action
    const action = service.loadPropertyUrl(client, 'https://www.idealista.com/inmueble/1/');

    // Assert
    await expect(action).rejects.toThrow(
      'Property URL is not visible in current results DOM and cannot be clicked: https://www.idealista.com/inmueble/1/'
    );
    expect(loadPropertyDetailFromResultsUseCase.execute).toHaveBeenCalledWith(
      client,
      'https://www.idealista.com/inmueble/1/',
      expect.any(Function)
    );
  });

  it('whenLoadingFromDatabaseFails_loadPropertyUrlFromDatabase_shouldPropagateErrorFromUseCase', async () => {
    // Arrange
    const { service, revalidatePropertyDetailFromDatabaseUseCase } = createService();
    const client = createClient();
    revalidatePropertyDetailFromDatabaseUseCase.execute.mockRejectedValue(new Error('navigation failed'));

    // Action
    const action = service.loadPropertyUrlFromDatabase(client, 'https://www.idealista.com/inmueble/6/');

    // Assert
    await expect(action).rejects.toThrow('navigation failed');
    expect(revalidatePropertyDetailFromDatabaseUseCase.execute).toHaveBeenCalledWith(
      client,
      'https://www.idealista.com/inmueble/6/',
      expect.any(Function)
    );
  });

  it('whenLoadingFromResultsSucceeds_loadPropertyUrl_shouldProcessLoadedDetailWithAlwaysMode', async () => {
    // Arrange
    const { service, loadPropertyDetailFromResultsUseCase, processLoadedPropertyDetailUseCase } = createService();
    const client = createClient();
    loadPropertyDetailFromResultsUseCase.execute.mockImplementation(async (_client, _url, onDetailLoaded) => {
      await onDetailLoaded();
    });
    processLoadedPropertyDetailUseCase.execute.mockResolvedValue(undefined);

    // Action
    await service.loadPropertyUrl(client, 'https://www.idealista.com/inmueble/7/');

    // Assert
    expect(processLoadedPropertyDetailUseCase.execute).toHaveBeenCalledWith(
      client,
      'https://www.idealista.com/inmueble/7/',
      'ALWAYS'
    );
  });

  it('whenLoadingFromDatabaseSucceeds_loadPropertyUrlFromDatabase_shouldProcessLoadedDetailWithConditionalGeoHintMode', async () => {
    // Arrange
    const {
      service,
      revalidatePropertyDetailFromDatabaseUseCase,
      processLoadedPropertyDetailUseCase
    } = createService();
    const client = createClient();
    revalidatePropertyDetailFromDatabaseUseCase.execute.mockImplementation(async (_client, _url, onDetailLoaded) => {
      await onDetailLoaded();
    });
    processLoadedPropertyDetailUseCase.execute.mockResolvedValue(undefined);

    // Action
    await service.loadPropertyUrlFromDatabase(client, 'https://www.idealista.com/inmueble/8/');

    // Assert
    expect(processLoadedPropertyDetailUseCase.execute).toHaveBeenCalledWith(
      client,
      'https://www.idealista.com/inmueble/8/',
      'ONLY_WHEN_MISSING_IN_DB'
    );
  });
});
