import { describe, expect, it, jest } from '@jest/globals';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { ExecuteMainSearchFormUseCase } from 'src/application/usecases/scraper/execute-main-search-form.use-case';

import type { FiltersCdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
class ExecuteMainSearchFormUseCaseMock {
  readonly execute = jest.fn<(client: FiltersCdpClient, mainSearchArea: string, scraperHomeUrl: string) => Promise<void>>();
}

function createClient(): FiltersCdpClient {
  return {
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    },
    Page: {
      reload: jest.fn(async () => undefined),
      loadEventFired: jest.fn()
    }
  };
}

describe('MainPageService', () => {
  it('whenExecuteIsRequested_execute_shouldDelegateToExecuteMainSearchFormUseCase', async () => {
    // Arrange
    const executeMainSearchFormUseCase = new ExecuteMainSearchFormUseCaseMock();
    executeMainSearchFormUseCase.execute.mockResolvedValue(undefined);
    const service = new MainPageService(executeMainSearchFormUseCase as unknown as ExecuteMainSearchFormUseCase);
    const client = createClient();
    // Action
    await service.execute(client, 'Madrid', 'https://www.idealista.com/');
    // Assert
    expect(executeMainSearchFormUseCase.execute).toHaveBeenCalledWith(client, 'Madrid', 'https://www.idealista.com/');
    expect(executeMainSearchFormUseCase.execute).toHaveBeenCalledTimes(1);
  });
});

