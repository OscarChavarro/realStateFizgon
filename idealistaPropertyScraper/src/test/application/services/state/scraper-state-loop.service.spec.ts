import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { sleep } from 'src/infrastructure/sleep';

jest.mock('src/infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

type ScraperStateLoopHandlers = {
  onScrapingForNewProperties: () => Promise<void>;
  onUpdatingProperties: () => Promise<void>;
  onLoopError: (error: unknown) => Promise<void>;
  isShuttingDown: () => boolean;
};

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

type ScraperStateLoopServiceInternals = {
  runLoop: (handlers: ScraperStateLoopHandlers) => Promise<void>;
  loopRunning: boolean;
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

function createService(params?: {
  stateMachine?: StateMachineMock;
  schedule?: ScheduleServiceMock;
}): {
  service: ScraperStateLoopService;
  stateMachine: StateMachineMock;
  schedule: ScheduleServiceMock;
} {
  const stateMachine = params?.stateMachine ?? createStateMachineMock();
  const schedule = params?.schedule ?? {
    promoteIdleToScheduledScrapeIfDue: jest.fn(() => false)
  };
  const service = new ScraperStateLoopService(
    stateMachine as unknown as ScraperStateMachineService,
    schedule as unknown as ScheduleService
  );
  return { service, stateMachine, schedule };
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
    const { service } = createService();
    const internals = service as unknown as ScraperStateLoopServiceInternals;
    internals.loopRunning = true;
    const runLoopSpy = jest.spyOn(internals, 'runLoop').mockResolvedValue(undefined);
    const handlers = createHandlers(() => true);
    // Action
    service.start(handlers);
    // Assert
    expect(runLoopSpy).not.toHaveBeenCalled();
    expect(internals.loopRunning).toBe(true);
  });

  it('whenLoopFinishesWithoutErrors_start_shouldClearRunningFlagWithoutInvokingErrorHandler', async () => {
    // Arrange
    const { service } = createService();
    const internals = service as unknown as ScraperStateLoopServiceInternals;
    const runLoopSpy = jest.spyOn(internals, 'runLoop').mockResolvedValue(undefined);
    const handlers = createHandlers(() => true);
    // Action
    service.start(handlers);
    await flushAsyncChain();
    // Assert
    expect(runLoopSpy).toHaveBeenCalledTimes(1);
    expect(handlers.onLoopError).not.toHaveBeenCalled();
    expect(internals.loopRunning).toBe(false);
  });

  it('whenLoopThrows_start_shouldDelegateToErrorHandlerAndClearRunningFlag', async () => {
    // Arrange
    const { service } = createService();
    const internals = service as unknown as ScraperStateLoopServiceInternals;
    const loopError = new Error('loop failed');
    const runLoopSpy = jest.spyOn(internals, 'runLoop').mockRejectedValue(loopError);
    const handlers = createHandlers(() => true);
    // Action
    service.start(handlers);
    await flushAsyncChain();
    // Assert
    expect(runLoopSpy).toHaveBeenCalledTimes(1);
    expect(handlers.onLoopError).toHaveBeenCalledWith(loopError);
    expect(internals.loopRunning).toBe(false);
  });

  it('whenStateIsScrapingForNewProperties_runLoop_shouldExecuteScrapingHandlerAndFinishCycle', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    const { service } = createService({ stateMachine });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await (service as unknown as ScraperStateLoopServiceInternals).runLoop(handlers);
    // Assert
    expect(handlers.onScrapingForNewProperties).toHaveBeenCalledTimes(1);
    expect(stateMachine.finishScrapingForNewPropertiesCycle).toHaveBeenCalledTimes(1);
    expect(handlers.onUpdatingProperties).not.toHaveBeenCalled();
  });

  it('whenStateIsUpdatingProperties_runLoop_shouldExecuteUpdatingHandlerAndFinishCycle', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.UPDATING_PROPERTIES);
    const { service } = createService({ stateMachine });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await (service as unknown as ScraperStateLoopServiceInternals).runLoop(handlers);
    // Assert
    expect(handlers.onUpdatingProperties).toHaveBeenCalledTimes(1);
    expect(stateMachine.finishUpdatingPropertiesCycle).toHaveBeenCalledTimes(1);
    expect(handlers.onScrapingForNewProperties).not.toHaveBeenCalled();
  });

  it.each([
    { consumedState: ScraperState.UPDATING_PROPERTIES, shouldSetState: true },
    { consumedState: undefined, shouldSetState: false }
  ])(
    'whenIdleHasPendingRequestAndConsumedStateIs$consumedState_runLoop_shouldHandleQueueConsumption',
    async ({ consumedState, shouldSetState }) => {
      // Arrange
      const stateMachine = createStateMachineMock();
      stateMachine.getCurrentState.mockReturnValue(ScraperState.IDLE);
      stateMachine.getPendingRequestsCount.mockReturnValue(1);
      stateMachine.consumeNextRequestedState.mockReturnValue(consumedState);
      const { service, schedule } = createService({ stateMachine });
      let loopChecks = 0;
      const handlers = createHandlers(() => {
        loopChecks += 1;
        return loopChecks > 1;
      });
      // Action
      await (service as unknown as ScraperStateLoopServiceInternals).runLoop(handlers);
      // Assert
      expect(stateMachine.consumeNextRequestedState).toHaveBeenCalledTimes(1);
      expect(stateMachine.setState).toHaveBeenCalledTimes(shouldSetState ? 1 : 0);
      expect(schedule.promoteIdleToScheduledScrapeIfDue).not.toHaveBeenCalled();
    }
  );

  it('whenIdleHasNoPendingRequestAndSchedulerPromotes_runLoop_shouldSkipSleepAndContinue', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.IDLE);
    stateMachine.getPendingRequestsCount.mockReturnValue(0);
    const schedule: ScheduleServiceMock = {
      promoteIdleToScheduledScrapeIfDue: jest.fn(() => true)
    };
    const { service } = createService({ stateMachine, schedule });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await (service as unknown as ScraperStateLoopServiceInternals).runLoop(handlers);
    // Assert
    expect(schedule.promoteIdleToScheduledScrapeIfDue).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenIdleHasNoPendingRequestAndSchedulerDoesNotPromote_runLoop_shouldSleepBeforeNextPoll', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.IDLE);
    stateMachine.getPendingRequestsCount.mockReturnValue(0);
    const schedule: ScheduleServiceMock = {
      promoteIdleToScheduledScrapeIfDue: jest.fn(() => false)
    };
    const { service } = createService({ stateMachine, schedule });
    let loopChecks = 0;
    const handlers = createHandlers(() => {
      loopChecks += 1;
      return loopChecks > 1;
    });
    // Action
    await (service as unknown as ScraperStateLoopServiceInternals).runLoop(handlers);
    // Assert
    expect(schedule.promoteIdleToScheduledScrapeIfDue).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
