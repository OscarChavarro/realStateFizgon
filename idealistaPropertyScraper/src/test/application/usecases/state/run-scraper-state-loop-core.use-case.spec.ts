import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProcessScraperStateTransitionUseCase } from 'application/usecases/state/process-scraper-state-transition.use-case';
import { RunScraperStateLoopCoreUseCase } from 'application/usecases/state/run-scraper-state-loop-core.use-case';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';

type HandlerMocks = {
  onScrapingForNewProperties: jest.MockedFunction<() => Promise<void>>;
  onUpdatingProperties: jest.MockedFunction<() => Promise<void>>;
  onLoopError: jest.MockedFunction<(error: unknown) => Promise<void>>;
  isShuttingDown: jest.MockedFunction<() => boolean>;
};

type ProcessScraperStateTransitionUseCaseMock = {
  execute: jest.MockedFunction<(handlers: HandlerMocks) => Promise<boolean>>;
};

type SleepPortMock = {
  sleep: jest.MockedFunction<(ms: number) => Promise<void>>;
};

type RunScraperStateLoopCoreUseCaseInternals = {
  logger: {
    log: (message: string) => void;
  };
};

function createHandlers(isShuttingDown: () => boolean): HandlerMocks {
  return {
    onScrapingForNewProperties: jest.fn(async () => undefined),
    onUpdatingProperties: jest.fn(async () => undefined),
    onLoopError: jest.fn(async (_error: unknown) => undefined),
    isShuttingDown: jest.fn(isShuttingDown)
  };
}

function createUseCase(): {
  useCase: RunScraperStateLoopCoreUseCase;
  processScraperStateTransitionUseCase: ProcessScraperStateTransitionUseCaseMock;
  sleepPort: SleepPortMock;
} {
  const processScraperStateTransitionUseCase: ProcessScraperStateTransitionUseCaseMock = {
    execute: jest.fn(async () => false)
  };
  const sleepPort: SleepPortMock = {
    sleep: jest.fn(async () => undefined)
  };
  const useCase = new RunScraperStateLoopCoreUseCase(
    processScraperStateTransitionUseCase as unknown as ProcessScraperStateTransitionUseCase,
    sleepPort as unknown as SleepPort
  );

  return { useCase, processScraperStateTransitionUseCase, sleepPort };
}

describe('RunScraperStateLoopCoreUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenTransitionIsProcessed_execute_shouldContinueWithoutSleeping', async () => {
    // Arrange
    const { useCase, processScraperStateTransitionUseCase, sleepPort } = createUseCase();
    processScraperStateTransitionUseCase.execute.mockResolvedValue(true);
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(processScraperStateTransitionUseCase.execute).toHaveBeenCalledTimes(1);
    expect(processScraperStateTransitionUseCase.execute).toHaveBeenCalledWith(handlers);
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenTransitionIsNotProcessed_execute_shouldSleepBeforeNextPoll', async () => {
    // Arrange
    const { useCase, processScraperStateTransitionUseCase, sleepPort } = createUseCase();
    processScraperStateTransitionUseCase.execute.mockResolvedValue(false);
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(processScraperStateTransitionUseCase.execute).toHaveBeenCalledTimes(1);
    expect(sleepPort.sleep).toHaveBeenCalledWith(500);
    expect(sleepPort.sleep).toHaveBeenCalledTimes(1);
  });

  it('whenShutdownIsRequested_execute_shouldLogThatLoopStopped', async () => {
    // Arrange
    const { useCase, processScraperStateTransitionUseCase } = createUseCase();
    const handlers = createHandlers(() => true);
    const logger = (useCase as unknown as RunScraperStateLoopCoreUseCaseInternals).logger;
    const logSpy = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(processScraperStateTransitionUseCase.execute).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Scraper state loop stopped because shutdown was requested.');
  });
});
