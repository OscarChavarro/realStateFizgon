import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ScraperStateLoopHandlers } from 'src/application/services/state/scraper-state-loop-handlers.type';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { RunScraperStateLoopCoreUseCase } from 'src/application/usecases/state/run-scraper-state-loop-core.use-case';

class RunScraperStateLoopCoreUseCaseMockForScraperStateLoopService {
  readonly execute = jest.fn<(handlers: ScraperStateLoopHandlers) => Promise<void>>();
}

type HandlerMocks = {
  onScrapingForNewProperties: jest.MockedFunction<() => Promise<void>>;
  onUpdatingProperties: jest.MockedFunction<() => Promise<void>>;
  onLoopError: jest.MockedFunction<(error: unknown) => Promise<void>>;
  isShuttingDown: jest.MockedFunction<() => boolean>;
};

type ScraperStateLoopServiceInternals = {
  loopRunning: boolean;
};

function createHandlers(isShuttingDown: () => boolean): HandlerMocks {
  return {
    onScrapingForNewProperties: jest.fn(async () => undefined),
    onUpdatingProperties: jest.fn(async () => undefined),
    onLoopError: jest.fn(async (_error: unknown) => undefined),
    isShuttingDown: jest.fn(isShuttingDown)
  };
}

function createService(): {
  service: ScraperStateLoopService;
  runScraperStateLoopCoreUseCase: RunScraperStateLoopCoreUseCaseMockForScraperStateLoopService;
} {
  const runScraperStateLoopCoreUseCase = new RunScraperStateLoopCoreUseCaseMockForScraperStateLoopService();
  const service = new ScraperStateLoopService(
    runScraperStateLoopCoreUseCase as unknown as RunScraperStateLoopCoreUseCase
  );

  return {
    service,
    runScraperStateLoopCoreUseCase
  };
}

async function flushAsyncChain(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('ScraperStateLoopService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenLoopIsAlreadyRunning_start_shouldReturnWithoutStartingAnotherLoop', () => {
    // Arrange
    const { service, runScraperStateLoopCoreUseCase } = createService();
    const internals = service as unknown as ScraperStateLoopServiceInternals;
    internals.loopRunning = true;
    const handlers = createHandlers(() => true);

    // Action
    service.start(handlers);

    // Assert
    expect(runScraperStateLoopCoreUseCase.execute).not.toHaveBeenCalled();
    expect(internals.loopRunning).toBe(true);
  });

  it('whenCoreLoopFinishesWithoutErrors_start_shouldClearRunningFlagWithoutInvokingErrorHandler', async () => {
    // Arrange
    const { service, runScraperStateLoopCoreUseCase } = createService();
    runScraperStateLoopCoreUseCase.execute.mockResolvedValue(undefined);
    const handlers = createHandlers(() => true);

    // Action
    service.start(handlers);
    await flushAsyncChain();

    // Assert
    expect(runScraperStateLoopCoreUseCase.execute).toHaveBeenCalledTimes(1);
    expect(runScraperStateLoopCoreUseCase.execute).toHaveBeenCalledWith(handlers);
    expect(handlers.onLoopError).not.toHaveBeenCalled();
    expect((service as unknown as ScraperStateLoopServiceInternals).loopRunning).toBe(false);
  });

  it('whenCoreLoopThrows_start_shouldDelegateToErrorHandlerAndClearRunningFlag', async () => {
    // Arrange
    const { service, runScraperStateLoopCoreUseCase } = createService();
    const loopError = new Error('loop failed');
    runScraperStateLoopCoreUseCase.execute.mockRejectedValue(loopError);
    const handlers = createHandlers(() => true);

    // Action
    service.start(handlers);
    await flushAsyncChain();

    // Assert
    expect(runScraperStateLoopCoreUseCase.execute).toHaveBeenCalledTimes(1);
    expect(handlers.onLoopError).toHaveBeenCalledWith(loopError);
    expect((service as unknown as ScraperStateLoopServiceInternals).loopRunning).toBe(false);
  });
});
