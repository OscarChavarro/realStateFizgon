import { describe, expect, it, jest } from '@jest/globals';
import { UpdatePropertiesController } from 'adapters/inbound/http/update-properties.controller';
import { ScraperState } from 'domain/states/scraper-state.enum';

import type { RequestScrapePropertiesPort } from 'ports/inbound/http/request-scrape-properties.port';
import type { RequestUpdatePropertiesPort } from 'ports/inbound/http/request-update-properties.port';

class RequestUpdatePropertiesUseCaseMockForUpdatePropertiesController {
  readonly execute = jest.fn<() => { status: string; state: ScraperState; pendingRequests: number }>();
}

class RequestScrapePropertiesUseCaseMockForUpdatePropertiesController {
  readonly execute = jest.fn<() => { status: string; state: ScraperState; pendingRequests: number }>();
}

describe('UpdatePropertiesController', () => {
  it('whenUpdateEndpointIsCalled_requestUpdateProperties_shouldDelegateToRequestUpdatePropertiesUseCase', () => {
    // Arrange
    const requestUpdatePropertiesUseCase = new RequestUpdatePropertiesUseCaseMockForUpdatePropertiesController();
    requestUpdatePropertiesUseCase.execute.mockReturnValue({
      status: 'queued',
      state: ScraperState.UPDATING_PROPERTIES,
      pendingRequests: 3
    });
    const requestScrapePropertiesUseCase = new RequestScrapePropertiesUseCaseMockForUpdatePropertiesController();
    const controller = new UpdatePropertiesController(
      requestUpdatePropertiesUseCase as unknown as RequestUpdatePropertiesPort,
      requestScrapePropertiesUseCase as unknown as RequestScrapePropertiesPort
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
    expect(requestScrapePropertiesUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenScrapeEndpointIsCalled_requestScrapeProperties_shouldDelegateToRequestScrapePropertiesUseCase', () => {
    // Arrange
    const requestUpdatePropertiesUseCase = new RequestUpdatePropertiesUseCaseMockForUpdatePropertiesController();
    const requestScrapePropertiesUseCase = new RequestScrapePropertiesUseCaseMockForUpdatePropertiesController();
    requestScrapePropertiesUseCase.execute.mockReturnValue({
      status: 'queued',
      state: ScraperState.SCRAPING_FOR_NEW_PROPERTIES,
      pendingRequests: 2
    });
    const controller = new UpdatePropertiesController(
      requestUpdatePropertiesUseCase as unknown as RequestUpdatePropertiesPort,
      requestScrapePropertiesUseCase as unknown as RequestScrapePropertiesPort
    );
    // Action
    const result = controller.requestScrapeProperties();
    // Assert
    expect(result).toEqual({
      status: 'queued',
      state: ScraperState.SCRAPING_FOR_NEW_PROPERTIES,
      pendingRequests: 2
    });
    expect(requestScrapePropertiesUseCase.execute).toHaveBeenCalledTimes(1);
    expect(requestUpdatePropertiesUseCase.execute).not.toHaveBeenCalled();
  });
});
