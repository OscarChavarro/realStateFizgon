import { describe, expect, it, jest } from '@jest/globals';
import { UpdatePropertiesController } from 'src/adapters/inbound/http/update-properties.controller';
import { RequestUpdatePropertiesUseCase } from 'src/application/usecases/request-update-properties.use-case';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

class ScraperStateMachineServiceMock {
  readonly enqueueScrapePropertiesRequest = jest.fn<() => number>();
  readonly getCurrentState = jest.fn<() => ScraperState>();
}

class RequestUpdatePropertiesUseCaseMock {
  readonly execute = jest.fn<() => { status: string; state: ScraperState; pendingRequests: number }>();
}

describe('UpdatePropertiesController', () => {
  it('whenUpdateEndpointIsCalled_requestUpdateProperties_shouldDelegateToRequestUpdatePropertiesUseCase', () => {
    // Arrange
    const requestUpdatePropertiesUseCase = new RequestUpdatePropertiesUseCaseMock();
    requestUpdatePropertiesUseCase.execute.mockReturnValue({
      status: 'queued',
      state: ScraperState.UPDATING_PROPERTIES,
      pendingRequests: 3
    });
    const machine = new ScraperStateMachineServiceMock();
    const controller = new UpdatePropertiesController(
      requestUpdatePropertiesUseCase as unknown as RequestUpdatePropertiesUseCase,
      machine as unknown as ScraperStateMachineService
    );
    // Action
    const result = controller.requestUpdateProperties();
    // Assert
    expect(result).toEqual({
      status: 'queued',
      state: ScraperState.UPDATING_PROPERTIES,
      pendingRequests: 3
    });
    expect(requestUpdatePropertiesUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('whenScrapeEndpointIsCalled_requestScrapeProperties_shouldQueueScrapeState', () => {
    // Arrange
    const requestUpdatePropertiesUseCase = new RequestUpdatePropertiesUseCaseMock();
    const machine = new ScraperStateMachineServiceMock();
    machine.enqueueScrapePropertiesRequest.mockReturnValue(2);
    machine.getCurrentState.mockReturnValue(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    const controller = new UpdatePropertiesController(
      requestUpdatePropertiesUseCase as unknown as RequestUpdatePropertiesUseCase,
      machine as unknown as ScraperStateMachineService
    );
    // Action
    const result = controller.requestScrapeProperties();
    // Assert
    expect(result).toEqual({
      status: 'queued',
      state: ScraperState.SCRAPING_FOR_NEW_PROPERTIES,
      pendingRequests: 2
    });
    expect(machine.enqueueScrapePropertiesRequest).toHaveBeenCalledTimes(1);
  });
});
