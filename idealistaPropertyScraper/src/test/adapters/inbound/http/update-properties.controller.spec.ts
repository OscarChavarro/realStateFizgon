import { describe, expect, it, jest } from '@jest/globals';
import { UpdatePropertiesController } from 'src/adapters/inbound/http/update-properties.controller';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

class ScraperStateMachineServiceMock {
  readonly enqueueUpdatePropertiesRequest = jest.fn<() => number>();
  readonly enqueueScrapePropertiesRequest = jest.fn<() => number>();
  readonly getCurrentState = jest.fn<() => ScraperState>();
}

describe('UpdatePropertiesController', () => {
  it('whenUpdateEndpointIsCalled_requestUpdateProperties_shouldQueueUpdateState', () => {
    // Arrange
    const machine = new ScraperStateMachineServiceMock();
    machine.enqueueUpdatePropertiesRequest.mockReturnValue(3);
    machine.getCurrentState.mockReturnValue(ScraperState.UPDATING_PROPERTIES);
    const controller = new UpdatePropertiesController(machine as unknown as ScraperStateMachineService);
    // Action
    const result = controller.requestUpdateProperties();
    // Assert
    expect(result).toEqual({
      status: 'queued',
      state: ScraperState.UPDATING_PROPERTIES,
      pendingRequests: 3
    });
    expect(machine.enqueueUpdatePropertiesRequest).toHaveBeenCalledTimes(1);
  });

  it('whenScrapeEndpointIsCalled_requestScrapeProperties_shouldQueueScrapeState', () => {
    // Arrange
    const machine = new ScraperStateMachineServiceMock();
    machine.enqueueScrapePropertiesRequest.mockReturnValue(2);
    machine.getCurrentState.mockReturnValue(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    const controller = new UpdatePropertiesController(machine as unknown as ScraperStateMachineService);
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
