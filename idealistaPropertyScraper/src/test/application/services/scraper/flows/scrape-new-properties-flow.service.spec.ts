import { describe, expect, it, jest } from '@jest/globals';
import { ScrapeNewPropertiesFlowService } from 'src/application/services/scraper/flows/scrape-new-properties-flow.service';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-scrape-new-properties-flow.use-case';

import type { ScraperCdpClient } from 'src/ports/outbound/browser/scraper-cdp-client.port';
class ExecuteScrapeNewPropertiesFlowUseCaseMockForScrapeNewPropertiesFlowService {
  readonly execute = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

function createClient(): ScraperCdpClient {
  return {
    Page: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      bringToFront: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      navigate: jest.fn<(params: { url: string }) => Promise<void>>().mockResolvedValue(undefined),
      reload: jest.fn<(params?: { ignoreCache?: boolean }) => Promise<void>>().mockResolvedValue(undefined),
      loadEventFired: jest.fn<(cb: () => void) => void>(),
      frameNavigated: jest.fn<(cb: (event: { frame?: { url?: string } }) => void) => void>()
    },
    Runtime: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    Network: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      responseReceived: jest.fn(),
      loadingFinished: jest.fn(),
      loadingFailed: jest.fn(),
      getResponseBody: jest.fn(async () => ({ body: '', base64Encoded: false }))
    },
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };
}

function createService() {
  const executeScrapeNewPropertiesFlowUseCase =
    new ExecuteScrapeNewPropertiesFlowUseCaseMockForScrapeNewPropertiesFlowService();
  const service = new ScrapeNewPropertiesFlowService(
    executeScrapeNewPropertiesFlowUseCase as unknown as ExecuteScrapeNewPropertiesFlowUseCase
  );

  return {
    service,
    executeScrapeNewPropertiesFlowUseCase
  };
}

describe('ScrapeNewPropertiesFlowService', () => {
  it('whenFlowServiceExecutes_execute_shouldDelegateToUseCase', async () => {
    // Arrange
    const { service, executeScrapeNewPropertiesFlowUseCase } = createService();
    const client = createClient();
    executeScrapeNewPropertiesFlowUseCase.execute.mockResolvedValue(undefined);

    // Action
    await service.execute(client);

    // Assert
    expect(executeScrapeNewPropertiesFlowUseCase.execute).toHaveBeenCalledTimes(1);
    expect(executeScrapeNewPropertiesFlowUseCase.execute).toHaveBeenCalledWith(client);
  });
});
