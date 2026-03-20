import { describe, expect, it, jest } from '@jest/globals';
import { DeactivatedDetailStatusService } from 'application/services/scraper/property/deactivated-detail-status.service';
import { HandleDeactivatedPropertyDetailUseCase } from 'application/usecases/scraper/handle-deactivated-property-detail.use-case';
import { MarkPropertyClosedUseCase } from 'application/usecases/scraper/mark-property-closed.use-case';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
class DeactivatedDetailStatusServiceMockForHandleDeactivatedPropertyDetailUseCase {
  readonly detect = jest.fn<(runtime: RuntimeClient) => Promise<{ isDeactivated: boolean; closedBy: Date | null }>>();
}

class MarkPropertyClosedUseCaseMockForHandleDeactivatedPropertyDetailUseCase {
  readonly execute = jest.fn<(url: string, closedBy?: Date) => Promise<void>>();
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
    const markPropertyClosedUseCase = new MarkPropertyClosedUseCaseMockForHandleDeactivatedPropertyDetailUseCase();
    const useCase = new HandleDeactivatedPropertyDetailUseCase(
      deactivatedDetailStatusService as unknown as DeactivatedDetailStatusService,
      markPropertyClosedUseCase as unknown as MarkPropertyClosedUseCase
    );
    const runtime = createRuntime();
    const url = 'https://www.idealista.com/inmueble/123/';
    deactivatedDetailStatusService.detect.mockResolvedValue(detectResult);
    markPropertyClosedUseCase.execute.mockResolvedValue(undefined);

    // Action
    const handled = await useCase.execute(runtime, url);

    // Assert
    expect(handled).toBe(expectedHandled);
    expect(deactivatedDetailStatusService.detect).toHaveBeenCalledWith(runtime);
    expect(markPropertyClosedUseCase.execute).toHaveBeenCalledTimes(expectedMarkCalls);
    if (expectedMarkCalls > 0) {
      expect(markPropertyClosedUseCase.execute).toHaveBeenCalledWith(url, expectedClosedBy);
    }
  });
});
