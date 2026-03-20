import { describe, expect, it, jest } from '@jest/globals';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { RequestUpdatePropertiesUseCase } from 'src/application/usecases/state/request-update-properties.use-case';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

class ScraperStateMachineServiceMockForRequestUpdatePropertiesUseCase {
  readonly enqueueUpdatePropertiesRequest = jest.fn<() => number>();
  readonly getCurrentState = jest.fn<() => ScraperState>();
}

describe('RequestUpdatePropertiesUseCase', () => {
  it('whenExecuteIsCalled_execute_shouldQueueUpdateAndReturnQueuedResponse', () => {
    // Arrange
    const scraperStateMachineService = new ScraperStateMachineServiceMockForRequestUpdatePropertiesUseCase();
    scraperStateMachineService.enqueueUpdatePropertiesRequest.mockReturnValue(4);
    scraperStateMachineService.getCurrentState.mockReturnValue(ScraperState.UPDATING_PROPERTIES);
    const useCase = new RequestUpdatePropertiesUseCase(
      scraperStateMachineService as unknown as ScraperStateMachineService
    );
    // Action
    const result = useCase.execute();
    // Assert
    expect(scraperStateMachineService.enqueueUpdatePropertiesRequest).toHaveBeenCalledTimes(1);
    expect(scraperStateMachineService.getCurrentState).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'queued',
      state: ScraperState.UPDATING_PROPERTIES,
      pendingRequests: 4
    });
  });
});
