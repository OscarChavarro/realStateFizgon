import { describe, expect, it, jest } from '@jest/globals';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { RequestScrapePropertiesUseCase } from 'src/application/usecases/request-scrape-properties.use-case';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

class ScraperStateMachineServiceMockForRequestScrapePropertiesUseCase {
  readonly enqueueScrapePropertiesRequest = jest.fn<() => number>();
  readonly getCurrentState = jest.fn<() => ScraperState>();
}

describe('RequestScrapePropertiesUseCase', () => {
  it('whenExecuteIsCalled_execute_shouldQueueScrapeAndReturnQueuedResponse', () => {
    // Arrange
    const scraperStateMachineService = new ScraperStateMachineServiceMockForRequestScrapePropertiesUseCase();
    scraperStateMachineService.enqueueScrapePropertiesRequest.mockReturnValue(5);
    scraperStateMachineService.getCurrentState.mockReturnValue(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    const useCase = new RequestScrapePropertiesUseCase(
      scraperStateMachineService as unknown as ScraperStateMachineService
    );
    // Action
    const result = useCase.execute();
    // Assert
    expect(scraperStateMachineService.enqueueScrapePropertiesRequest).toHaveBeenCalledTimes(1);
    expect(scraperStateMachineService.getCurrentState).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'queued',
      state: ScraperState.SCRAPING_FOR_NEW_PROPERTIES,
      pendingRequests: 5
    });
  });
});
