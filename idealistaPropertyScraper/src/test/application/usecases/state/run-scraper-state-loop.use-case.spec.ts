import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { RunScraperStateLoopCoreUseCase } from 'application/usecases/state/run-scraper-state-loop-core.use-case';
import { RunScraperStateLoopUseCase } from 'application/usecases/state/run-scraper-state-loop.use-case';

import type { ScraperStateLoopHandlers } from 'application/usecases/state/scraper-state-loop-handlers.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

class RunScraperStateLoopCoreUseCaseMockForRunScraperStateLoopUseCase {
  readonly execute = jest.fn<(handlers: ScraperStateLoopHandlers) => Promise<void>>();
}

class ChromiumFailureGuardServiceMockForRunScraperStateLoopUseCase {
  readonly recoverFromFailure = jest.fn<
    (params: {
      reason: string;
      cdpHost: string;
      cdpPort: number;
      browserFailureRecoveryWaitMs: number;
      isShuttingDown: () => boolean;
      onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    }) => Promise<void>
  >();
}

class ErrorMessagePortMockForRunScraperStateLoopUseCase implements ErrorMessagePort {
  readonly toErrorMessage = jest.fn<(error: unknown) => string>();
}

type RunScraperStateLoopUseCaseInternals = {
  loopRunning: boolean;
};

function createUseCase() {
  const runScraperStateLoopCoreUseCase = new RunScraperStateLoopCoreUseCaseMockForRunScraperStateLoopUseCase();
  const chromiumFailureGuardService = new ChromiumFailureGuardServiceMockForRunScraperStateLoopUseCase();
  chromiumFailureGuardService.recoverFromFailure.mockResolvedValue(undefined);
  const errorMessagePort = new ErrorMessagePortMockForRunScraperStateLoopUseCase();
  errorMessagePort.toErrorMessage.mockImplementation((error: unknown) =>
    error instanceof Error ? error.message : String(error)
  );
  const useCase = new RunScraperStateLoopUseCase(
    runScraperStateLoopCoreUseCase as unknown as RunScraperStateLoopCoreUseCase,
    chromiumFailureGuardService as unknown as ChromiumFailureGuardService,
    errorMessagePort
  );

  return {
    useCase,
    runScraperStateLoopCoreUseCase,
    chromiumFailureGuardService,
    errorMessagePort
  };
}

function createParams() {
  return {
    cdpHost: '127.0.0.1',
    cdpPort: 9222,
    isShuttingDown: (): boolean => false,
    onUnexpectedChromeExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>(),
    browserFailureRecoveryWaitMs: 12345,
    onScrapingForNewProperties: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onUpdatingProperties: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onAfterRecovery: jest.fn<() => void>()
  };
}

function createDeferredPromise<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve,
    reject
  };
}

async function flushAsyncChain(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('RunScraperStateLoopUseCase', () => {
  it('whenUseCaseExecutes_execute_shouldStartCoreStateLoopWithGivenHandlers', async () => {
    // Arrange
    const { useCase, runScraperStateLoopCoreUseCase } = createUseCase();
    runScraperStateLoopCoreUseCase.execute.mockResolvedValue(undefined);
    const params = createParams();
    // Action
    useCase.execute(params);
    await flushAsyncChain();
    // Assert
    expect(runScraperStateLoopCoreUseCase.execute).toHaveBeenCalledTimes(1);
    const handlers = runScraperStateLoopCoreUseCase.execute.mock.calls[0][0];
    expect(handlers.onScrapingForNewProperties).toBe(params.onScrapingForNewProperties);
    expect(handlers.onUpdatingProperties).toBe(params.onUpdatingProperties);
    expect(handlers.isShuttingDown).toBe(params.isShuttingDown);
    await handlers.onScrapingForNewProperties();
    await handlers.onUpdatingProperties();
    expect(params.onScrapingForNewProperties).toHaveBeenCalledTimes(1);
    expect(params.onUpdatingProperties).toHaveBeenCalledTimes(1);
    expect((useCase as unknown as RunScraperStateLoopUseCaseInternals).loopRunning).toBe(false);
  });

  it('whenLoopIsAlreadyRunning_execute_shouldReturnWithoutStartingAnotherLoop', async () => {
    // Arrange
    const { useCase, runScraperStateLoopCoreUseCase } = createUseCase();
    const deferred = createDeferredPromise<void>();
    runScraperStateLoopCoreUseCase.execute.mockReturnValue(deferred.promise);
    const params = createParams();
    useCase.execute(params);
    // Action
    useCase.execute(params);
    deferred.resolve(undefined);
    await flushAsyncChain();
    // Assert
    expect(runScraperStateLoopCoreUseCase.execute).toHaveBeenCalledTimes(1);
    expect((useCase as unknown as RunScraperStateLoopUseCaseInternals).loopRunning).toBe(false);
  });

  it('whenCoreLoopFails_execute_shouldRecoverAndScheduleRestart', async () => {
    // Arrange
    const {
      useCase,
      runScraperStateLoopCoreUseCase,
      chromiumFailureGuardService,
      errorMessagePort
    } = createUseCase();
    runScraperStateLoopCoreUseCase.execute.mockRejectedValue(new Error('boom'));
    const params = createParams();
    // Action
    useCase.execute(params);
    await flushAsyncChain();
    // Assert
    expect(errorMessagePort.toErrorMessage).toHaveBeenCalledWith(expect.any(Error));
    expect(chromiumFailureGuardService.recoverFromFailure).toHaveBeenCalledWith({
      reason: 'Scraper state loop failed. boom',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 12345,
      isShuttingDown: params.isShuttingDown,
      onUnexpectedExit: params.onUnexpectedChromeExit
    });
    expect(params.onAfterRecovery).toHaveBeenCalledTimes(1);
    expect((useCase as unknown as RunScraperStateLoopUseCaseInternals).loopRunning).toBe(false);
  });

  it('whenRecoveryFails_execute_shouldStillClearRunningFlag', async () => {
    // Arrange
    const { useCase, runScraperStateLoopCoreUseCase, chromiumFailureGuardService } = createUseCase();
    runScraperStateLoopCoreUseCase.execute.mockRejectedValue(new Error('boom'));
    chromiumFailureGuardService.recoverFromFailure.mockRejectedValue(new Error('recovery failed'));
    const params = createParams();
    // Action
    useCase.execute(params);
    await flushAsyncChain();
    // Assert
    expect(params.onAfterRecovery).not.toHaveBeenCalled();
    expect((useCase as unknown as RunScraperStateLoopUseCaseInternals).loopRunning).toBe(false);
  });
});
