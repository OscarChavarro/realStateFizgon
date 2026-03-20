import { describe, expect, it, jest } from '@jest/globals';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-update-existing-properties-flow.use-case';

import type { ScraperCdpClient } from 'src/ports/outbound/browser/scraper-cdp-client.port';
class ExecuteUpdateExistingPropertiesFlowUseCaseMock {
  readonly execute = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

function createClient(): ScraperCdpClient {
  return {
    Page: {
      enable: jest.fn(async () => undefined),
      bringToFront: jest.fn(async () => undefined),
      navigate: jest.fn(async () => ({ frameId: 'frame' }))
    },
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    close: jest.fn(async () => undefined)
  } as unknown as ScraperCdpClient;
}

describe('UpdateExistingPropertiesFlowService', () => {
  it('whenFlowServiceExecutes_execute_shouldDelegateToUseCase', async () => {
    // Arrange
    const useCase = new ExecuteUpdateExistingPropertiesFlowUseCaseMock();
    const service = new UpdateExistingPropertiesFlowService(
      useCase as unknown as ExecuteUpdateExistingPropertiesFlowUseCase
    );
    const client = createClient();

    // Action
    await service.execute(client);

    // Assert
    expect(useCase.execute).toHaveBeenCalledTimes(1);
    expect(useCase.execute).toHaveBeenCalledWith(client);
  });
});
