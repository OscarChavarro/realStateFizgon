import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ResolveIdleStateUseCase } from 'src/application/usecases/state/resolve-idle-state.use-case';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

type StateMachineMock = {
  getPendingRequestsCount: jest.MockedFunction<() => number>;
  consumeNextRequestedState: jest.MockedFunction<() => ScraperState | undefined>;
  setState: jest.MockedFunction<(state: ScraperState) => void>;
};

type ScheduleServiceMock = {
  promoteIdleToScheduledScrapeIfDue: jest.MockedFunction<() => boolean>;
};

function createStateMachineMock(): StateMachineMock {
  return {
    getPendingRequestsCount: jest.fn(() => 0),
    consumeNextRequestedState: jest.fn(() => undefined),
    setState: jest.fn((state: ScraperState) => {
      void state;
    })
  };
}

function createUseCase(params?: {
  stateMachine?: StateMachineMock;
  schedule?: ScheduleServiceMock;
}): {
  useCase: ResolveIdleStateUseCase;
  stateMachine: StateMachineMock;
  schedule: ScheduleServiceMock;
} {
  const stateMachine = params?.stateMachine ?? createStateMachineMock();
  const schedule = params?.schedule ?? {
    promoteIdleToScheduledScrapeIfDue: jest.fn(() => false)
  };
  const useCase = new ResolveIdleStateUseCase(
    stateMachine as unknown as ScraperStateMachineService,
    schedule as unknown as ScheduleService
  );

  return { useCase, stateMachine, schedule };
}

describe('ResolveIdleStateUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    { consumedState: ScraperState.UPDATING_PROPERTIES, shouldSetState: true },
    { consumedState: undefined, shouldSetState: false }
  ])(
    'whenIdleHasPendingRequestAndConsumedStateIs$consumedState_execute_shouldHandleQueuedState',
    ({ consumedState, shouldSetState }) => {
      // Arrange
      const stateMachine = createStateMachineMock();
      stateMachine.getPendingRequestsCount.mockReturnValue(1);
      stateMachine.consumeNextRequestedState.mockReturnValue(consumedState);
      const { useCase, schedule } = createUseCase({ stateMachine });
      // Action
      const transitionProcessed = useCase.execute();
      // Assert
      expect(transitionProcessed).toBe(true);
      expect(stateMachine.consumeNextRequestedState).toHaveBeenCalledTimes(1);
      expect(stateMachine.setState).toHaveBeenCalledTimes(shouldSetState ? 1 : 0);
      expect(schedule.promoteIdleToScheduledScrapeIfDue).not.toHaveBeenCalled();
    }
  );

  it('whenIdleHasNoPendingRequestAndSchedulerPromotes_execute_shouldReturnTrue', () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getPendingRequestsCount.mockReturnValue(0);
    const schedule: ScheduleServiceMock = {
      promoteIdleToScheduledScrapeIfDue: jest.fn(() => true)
    };
    const { useCase } = createUseCase({ stateMachine, schedule });
    // Action
    const transitionProcessed = useCase.execute();
    // Assert
    expect(transitionProcessed).toBe(true);
    expect(schedule.promoteIdleToScheduledScrapeIfDue).toHaveBeenCalledTimes(1);
  });

  it('whenIdleHasNoPendingRequestAndSchedulerDoesNotPromote_execute_shouldReturnFalse', () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getPendingRequestsCount.mockReturnValue(0);
    const schedule: ScheduleServiceMock = {
      promoteIdleToScheduledScrapeIfDue: jest.fn(() => false)
    };
    const { useCase } = createUseCase({ stateMachine, schedule });
    // Action
    const transitionProcessed = useCase.execute();
    // Assert
    expect(transitionProcessed).toBe(false);
    expect(schedule.promoteIdleToScheduledScrapeIfDue).toHaveBeenCalledTimes(1);
  });
});
