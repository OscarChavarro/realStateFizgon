import { describe, expect, it, jest } from '@jest/globals';
import { DeactivatedDetailStatusService } from 'src/application/services/scraper/property/deactivated-detail-status.service';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { HandleDeactivatedPropertyDetailUseCase } from 'src/application/usecases/scraper/handle-deactivated-property-detail.use-case';

import type { RuntimeClient } from 'src/ports/outbound/browser/runtime-client.port';
class DeactivatedDetailStatusServiceMockForHandleDeactivatedPropertyDetailUseCase {
  readonly detect = jest.fn<(runtime: RuntimeClient) => Promise<{ isDeactivated: boolean; closedBy: Date | null }>>();
}

class PropertyDetailStorageServiceMockForHandleDeactivatedPropertyDetailUseCase {
  readonly markPropertyClosed = jest.fn<(url: string, closedBy?: Date) => Promise<void>>();
}

function createRuntime(): RuntimeClient {
  return {
    evaluate: jest.fn(async () => ({ result: { value: true } }))
  };
}

describe('HandleDeactivatedPropertyDetailUseCase', () => {
  it.each([
    {
      detectResult: { isDeactivated: false, closedBy: null },
      expectedHandled: false,
      expectedClosedBy: undefined,
      expectedMarkCalls: 0
    },
    {
      detectResult: { isDeactivated: true, closedBy: null },
      expectedHandled: true,
      expectedClosedBy: undefined,
      expectedMarkCalls: 1
    },
    {
      detectResult: { isDeactivated: true, closedBy: new Date('2026-03-20T00:00:00.000Z') },
      expectedHandled: true,
      expectedClosedBy: new Date('2026-03-20T00:00:00.000Z'),
      expectedMarkCalls: 1
    }
  ])('whenDetectingDeactivatedStatus_execute_shouldMarkClosedOnlyWhenDeactivated', async ({
    detectResult,
    expectedHandled,
    expectedClosedBy,
    expectedMarkCalls
  }) => {
    // Arrange
    const deactivatedDetailStatusService = new DeactivatedDetailStatusServiceMockForHandleDeactivatedPropertyDetailUseCase();
    const storageService = new PropertyDetailStorageServiceMockForHandleDeactivatedPropertyDetailUseCase();
    const useCase = new HandleDeactivatedPropertyDetailUseCase(
      deactivatedDetailStatusService as unknown as DeactivatedDetailStatusService,
      storageService as unknown as PropertyDetailStorageService
    );
    const runtime = createRuntime();
    const url = 'https://www.idealista.com/inmueble/123/';
    deactivatedDetailStatusService.detect.mockResolvedValue(detectResult);
    storageService.markPropertyClosed.mockResolvedValue(undefined);

    // Action
    const handled = await useCase.execute(runtime, url);

    // Assert
    expect(handled).toBe(expectedHandled);
    expect(deactivatedDetailStatusService.detect).toHaveBeenCalledWith(runtime);
    expect(storageService.markPropertyClosed).toHaveBeenCalledTimes(expectedMarkCalls);
    if (expectedMarkCalls > 0) {
      expect(storageService.markPropertyClosed).toHaveBeenCalledWith(url, expectedClosedBy);
    }
  });
});
