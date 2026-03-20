import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { RunScraperStateLoopCoreUseCase } from 'src/application/usecases/state/run-scraper-state-loop-core.use-case';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { sleep } from 'src/infrastructure/sleep';

jest.mock('src/infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

type HandlerMocks = {
  onScrapingForNewProperties: jest.MockedFunction<() => Promise<void>>;
  onUpdatingProperties: jest.MockedFunction<() => Promise<void>>;
  onLoopError: jest.MockedFunction<(error: unknown) => Promise<void>>;
  isShuttingDown: jest.MockedFunction<() => boolean>;
};

type StateMachineMock = {
  getCurrentState: jest.MockedFunction<() => ScraperState>;
  finishScrapingForNewPropertiesCycle: jest.MockedFunction<() => ScraperState>;
  finishUpdatingPropertiesCycle: jest.MockedFunction<() => ScraperState>;
  getPendingRequestsCount: jest.MockedFunction<() => number>;
  consumeNextRequestedState: jest.MockedFunction<() => ScraperState | undefined>;
  setState: jest.MockedFunction<(state: ScraperState) => void>;
};

type ScheduleServiceMock = {
  promoteIdleToScheduledScrapeIfDue: jest.MockedFunction<() => boolean>;
};

type RunScraperStateLoopCoreUseCaseInternals = {
  logger: {
    log: (message: string) => void;
  };
};

function createStateMachineMock(): StateMachineMock {
  return {
    getCurrentState: jest.fn(() => ScraperState.IDLE),
    finishScrapingForNewPropertiesCycle: jest.fn(() => ScraperState.IDLE),
    finishUpdatingPropertiesCycle: jest.fn(() => ScraperState.IDLE),
    getPendingRequestsCount: jest.fn(() => 0),
    consumeNextRequestedState: jest.fn(() => undefined),
    setState: jest.fn((state: ScraperState) => {
      void state;
    })
  };
}

function createHandlers(isShuttingDown: () => boolean): HandlerMocks {
  return {
    onScrapingForNewProperties: jest.fn(async () => undefined),
    onUpdatingProperties: jest.fn(async () => undefined),
    onLoopError: jest.fn(async (_error: unknown) => undefined),
    isShuttingDown: jest.fn(isShuttingDown)
  };
}

function createUseCase(params?: {
  stateMachine?: StateMachineMock;
  schedule?: ScheduleServiceMock;
}): {
  useCase: RunScraperStateLoopCoreUseCase;
  stateMachine: StateMachineMock;
  schedule: ScheduleServiceMock;
} {
  const stateMachine = params?.stateMachine ?? createStateMachineMock();
  const schedule = params?.schedule ?? {
    promoteIdleToScheduledScrapeIfDue: jest.fn(() => false)
  };
  const useCase = new RunScraperStateLoopCoreUseCase(
    stateMachine as unknown as ScraperStateMachineService,
    schedule as unknown as ScheduleService
  );

  return { useCase, stateMachine, schedule };
}

describe('RunScraperStateLoopCoreUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenStateIsScrapingForNewProperties_execute_shouldExecuteScrapingHandlerAndFinishCycle', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    const { useCase } = createUseCase({ stateMachine });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(handlers.onScrapingForNewProperties).toHaveBeenCalledTimes(1);
    expect(stateMachine.finishScrapingForNewPropertiesCycle).toHaveBeenCalledTimes(1);
    expect(handlers.onUpdatingProperties).not.toHaveBeenCalled();
  });

  it('whenStateIsUpdatingProperties_execute_shouldExecuteUpdatingHandlerAndFinishCycle', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.UPDATING_PROPERTIES);
    const { useCase } = createUseCase({ stateMachine });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(handlers.onUpdatingProperties).toHaveBeenCalledTimes(1);
    expect(stateMachine.finishUpdatingPropertiesCycle).toHaveBeenCalledTimes(1);
    expect(handlers.onScrapingForNewProperties).not.toHaveBeenCalled();
  });

  it.each([
    { consumedState: ScraperState.UPDATING_PROPERTIES, shouldSetState: true },
    { consumedState: undefined, shouldSetState: false }
  ])(
    'whenIdleHasPendingRequestAndConsumedStateIs$consumedState_execute_shouldHandleQueueConsumption',
    async ({ consumedState, shouldSetState }) => {
      // Arrange
      const stateMachine = createStateMachineMock();
      stateMachine.getCurrentState.mockReturnValue(ScraperState.IDLE);
      stateMachine.getPendingRequestsCount.mockReturnValue(1);
      stateMachine.consumeNextRequestedState.mockReturnValue(consumedState);
      const { useCase, schedule } = createUseCase({ stateMachine });
      let loopChecks = 0;
      const handlers = createHandlers(() => {
        loopChecks += 1;
        return loopChecks > 1;
      });
      // Action
      await useCase.execute(handlers);
      // Assert
      expect(stateMachine.consumeNextRequestedState).toHaveBeenCalledTimes(1);
      expect(stateMachine.setState).toHaveBeenCalledTimes(shouldSetState ? 1 : 0);
      expect(schedule.promoteIdleToScheduledScrapeIfDue).not.toHaveBeenCalled();
    }
  );

  it('whenIdleHasNoPendingRequestAndSchedulerPromotes_execute_shouldSkipSleepAndContinue', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.IDLE);
    stateMachine.getPendingRequestsCount.mockReturnValue(0);
    const schedule: ScheduleServiceMock = {
      promoteIdleToScheduledScrapeIfDue: jest.fn(() => true)
    };
    const { useCase } = createUseCase({ stateMachine, schedule });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(schedule.promoteIdleToScheduledScrapeIfDue).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenIdleHasNoPendingRequestAndSchedulerDoesNotPromote_execute_shouldSleepBeforeNextPoll', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.IDLE);
    stateMachine.getPendingRequestsCount.mockReturnValue(0);
    const schedule: ScheduleServiceMock = {
      promoteIdleToScheduledScrapeIfDue: jest.fn(() => false)
    };
    const { useCase } = createUseCase({ stateMachine, schedule });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(schedule.promoteIdleToScheduledScrapeIfDue).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('whenShutdownIsRequested_execute_shouldLogThatLoopStopped', async () => {
    // Arrange
    const { useCase } = createUseCase();
    const handlers = createHandlers(() => true);
    const logger = (useCase as unknown as RunScraperStateLoopCoreUseCaseInternals).logger;
    const logSpy = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    // Action
    await useCase.execute(handlers);
    // Assert
    expect(logSpy).toHaveBeenCalledWith('Scraper state loop stopped because shutdown was requested.');
  });
});
