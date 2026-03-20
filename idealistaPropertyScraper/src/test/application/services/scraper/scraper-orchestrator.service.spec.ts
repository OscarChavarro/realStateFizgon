import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ScraperOrchestratorService } from 'src/application/services/scraper/scraper-orchestrator.service';
import { ExecuteScrapeNewPropertiesCycleUseCase } from 'src/application/usecases/chromium/execute-scrape-new-properties-cycle.use-case';
import { ExecuteUpdateExistingPropertiesCycleUseCase } from 'src/application/usecases/chromium/execute-update-existing-properties-cycle.use-case';
import { RunScraperStateLoopUseCase } from 'src/application/usecases/state/run-scraper-state-loop.use-case';

class ExecuteScrapeNewPropertiesCycleUseCaseMockForScraperOrchestratorService {
  readonly execute = jest.fn<(cdpHost: string, cdpPort: number) => Promise<void>>();
}

class ExecuteUpdateExistingPropertiesCycleUseCaseMockForScraperOrchestratorService {
  readonly execute = jest.fn<(cdpHost: string, cdpPort: number) => Promise<void>>();
}

class RunScraperStateLoopUseCaseMockForScraperOrchestratorService {
  readonly execute = jest.fn<
    (params: {
      cdpHost: string;
      cdpPort: number;
      isShuttingDown: () => boolean;
      onUnexpectedChromeExit: (code: number | null, signal: NodeJS.Signals | null) => void;
      browserFailureRecoveryWaitMs: number;
      onScrapingForNewProperties: () => Promise<void>;
      onUpdatingProperties: () => Promise<void>;
      onAfterRecovery: () => void;
    }) => void
  >();
}

type ScraperOrchestratorServiceInternals = {
  loopRestartScheduled: boolean;
};

function createService() {
  const executeScrapeNewPropertiesCycleUseCase = new ExecuteScrapeNewPropertiesCycleUseCaseMockForScraperOrchestratorService();
  executeScrapeNewPropertiesCycleUseCase.execute.mockResolvedValue(undefined);
  const executeUpdateExistingPropertiesCycleUseCase =
    new ExecuteUpdateExistingPropertiesCycleUseCaseMockForScraperOrchestratorService();
  executeUpdateExistingPropertiesCycleUseCase.execute.mockResolvedValue(undefined);
  const runScraperStateLoopUseCase = new RunScraperStateLoopUseCaseMockForScraperOrchestratorService();
  const service = new ScraperOrchestratorService(
    executeScrapeNewPropertiesCycleUseCase as unknown as ExecuteScrapeNewPropertiesCycleUseCase,
    executeUpdateExistingPropertiesCycleUseCase as unknown as ExecuteUpdateExistingPropertiesCycleUseCase,
    runScraperStateLoopUseCase as unknown as RunScraperStateLoopUseCase
  );

  return {
    service,
    executeScrapeNewPropertiesCycleUseCase,
    executeUpdateExistingPropertiesCycleUseCase,
    runScraperStateLoopUseCase
  };
}

describe('ScraperOrchestratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('whenStartIsCalled_start_shouldWireStateLoopHandlersAndDelegateCycleExecution', async () => {
    // Arrange
    const {
      service,
      executeScrapeNewPropertiesCycleUseCase,
      executeUpdateExistingPropertiesCycleUseCase,
      runScraperStateLoopUseCase
    } = createService();
    const params = {
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      isShuttingDown: (): boolean => false,
      onUnexpectedChromeExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>(),
      browserFailureRecoveryWaitMs: 10000
    };
    // Action
    service.start(params);
    const loopParams = runScraperStateLoopUseCase.execute.mock.calls[0]?.[0];
    await loopParams?.onScrapingForNewProperties();
    await loopParams?.onUpdatingProperties();
    // Assert
    expect(runScraperStateLoopUseCase.execute).toHaveBeenCalledTimes(1);
    expect(loopParams).toBeDefined();
    expect(loopParams?.cdpHost).toBe(params.cdpHost);
    expect(loopParams?.cdpPort).toBe(params.cdpPort);
    expect(loopParams?.isShuttingDown).toBe(params.isShuttingDown);
    expect(loopParams?.onUnexpectedChromeExit).toBe(params.onUnexpectedChromeExit);
    expect(loopParams?.browserFailureRecoveryWaitMs).toBe(params.browserFailureRecoveryWaitMs);
    expect(executeScrapeNewPropertiesCycleUseCase.execute).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(executeUpdateExistingPropertiesCycleUseCase.execute).toHaveBeenCalledWith('127.0.0.1', 9222);
  });

  it('whenRecoveryIsRequestedAndServiceIsRunning_onAfterRecovery_shouldScheduleSingleRestart', () => {
    // Arrange
    const { service, runScraperStateLoopUseCase } = createService();
    const params = {
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      isShuttingDown: (): boolean => false,
      onUnexpectedChromeExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>(),
      browserFailureRecoveryWaitMs: 12000
    };
    service.start(params);
    const loopParams = runScraperStateLoopUseCase.execute.mock.calls[0]?.[0];
    // Action
    loopParams?.onAfterRecovery();
    loopParams?.onAfterRecovery();
    jest.runOnlyPendingTimers();
    // Assert
    expect(runScraperStateLoopUseCase.execute).toHaveBeenCalledTimes(2);
    expect((service as unknown as ScraperOrchestratorServiceInternals).loopRestartScheduled).toBe(false);
  });

  it('whenRecoveryIsRequestedAndServiceIsShuttingDown_onAfterRecovery_shouldNotScheduleRestart', () => {
    // Arrange
    const { service, runScraperStateLoopUseCase } = createService();
    const params = {
      cdpHost: '127.0.0.1',
      cdpPort: 9444,
      isShuttingDown: (): boolean => true,
      onUnexpectedChromeExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>(),
      browserFailureRecoveryWaitMs: 14000
    };
    service.start(params);
    const loopParams = runScraperStateLoopUseCase.execute.mock.calls[0]?.[0];
    // Action
    loopParams?.onAfterRecovery();
    // Assert
    expect(jest.getTimerCount()).toBe(0);
    expect(runScraperStateLoopUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('whenShutdownStartsAfterSchedulingRestart_onAfterRecovery_shouldSkipRestartDuringTimerCallback', () => {
    // Arrange
    const { service, runScraperStateLoopUseCase } = createService();
    let shuttingDown = false;
    const params = {
      cdpHost: '127.0.0.1',
      cdpPort: 9555,
      isShuttingDown: (): boolean => shuttingDown,
      onUnexpectedChromeExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>(),
      browserFailureRecoveryWaitMs: 16000
    };
    service.start(params);
    const loopParams = runScraperStateLoopUseCase.execute.mock.calls[0]?.[0];
    // Action
    loopParams?.onAfterRecovery();
    shuttingDown = true;
    jest.runOnlyPendingTimers();
    // Assert
    expect(runScraperStateLoopUseCase.execute).toHaveBeenCalledTimes(1);
    expect((service as unknown as ScraperOrchestratorServiceInternals).loopRestartScheduled).toBe(false);
  });
});
