import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import { ProcessScraperStateTransitionUseCase } from 'application/usecases/state/process-scraper-state-transition.use-case';
import { ResolveIdleStateUseCase } from 'application/usecases/state/resolve-idle-state.use-case';
import { ScraperState } from 'domain/states/scraper-state';

type HandlerMocks = {
  onScrapingForNewProperties: jest.MockedFunction<() => Promise<void>>;
  onUpdatingProperties: jest.MockedFunction<() => Promise<void>>;
  isShuttingDown: jest.MockedFunction<() => boolean>;
};

type StateMachineMock = {
  getCurrentState: jest.MockedFunction<() => ScraperState>;
  finishScrapingForNewPropertiesCycle: jest.MockedFunction<() => ScraperState>;
  finishUpdatingPropertiesCycle: jest.MockedFunction<() => ScraperState>;
};

type ResolveIdleStateUseCaseMock = {
  execute: jest.MockedFunction<() => boolean>;
};

function createStateMachineMock(): StateMachineMock {
  return {
    getCurrentState: jest.fn(() => ScraperState.IDLE),
    finishScrapingForNewPropertiesCycle: jest.fn(() => ScraperState.IDLE),
    finishUpdatingPropertiesCycle: jest.fn(() => ScraperState.IDLE)
  };
}

function createHandlers(): HandlerMocks {
  return {
    onScrapingForNewProperties: jest.fn(async () => undefined),
    onUpdatingProperties: jest.fn(async () => undefined),
    isShuttingDown: jest.fn(() => false)
  };
}

function createUseCase(params?: {
  stateMachine?: StateMachineMock;
  resolveIdleState?: ResolveIdleStateUseCaseMock;
}): {
  useCase: ProcessScraperStateTransitionUseCase;
  stateMachine: StateMachineMock;
  resolveIdleState: ResolveIdleStateUseCaseMock;
} {
  const stateMachine = params?.stateMachine ?? createStateMachineMock();
  const resolveIdleState = params?.resolveIdleState ?? {
    execute: jest.fn(() => false)
  };
  const useCase = new ProcessScraperStateTransitionUseCase(
    stateMachine as unknown as ScraperStateMachineService,
    resolveIdleState as unknown as ResolveIdleStateUseCase
  );

  return { useCase, stateMachine, resolveIdleState };
}

describe('ProcessScraperStateTransitionUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenStateIsScrapingForNewProperties_execute_shouldRunScrapingHandlerAndFinishCycle', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    const { useCase, resolveIdleState } = createUseCase({ stateMachine });
    const handlers = createHandlers();
    // Action
    const transitionProcessed = await useCase.execute(handlers);
    // Assert
    expect(transitionProcessed).toBe(true);
    expect(handlers.onScrapingForNewProperties).toHaveBeenCalledTimes(1);
    expect(stateMachine.finishScrapingForNewPropertiesCycle).toHaveBeenCalledTimes(1);
    expect(resolveIdleState.execute).not.toHaveBeenCalled();
  });

  it('whenStateIsUpdatingProperties_execute_shouldRunUpdatingHandlerAndFinishCycle', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue(ScraperState.UPDATING_PROPERTIES);
    const { useCase, resolveIdleState } = createUseCase({ stateMachine });
    const handlers = createHandlers();
    // Action
    const transitionProcessed = await useCase.execute(handlers);
    // Assert
    expect(transitionProcessed).toBe(true);
    expect(handlers.onUpdatingProperties).toHaveBeenCalledTimes(1);
    expect(stateMachine.finishUpdatingPropertiesCycle).toHaveBeenCalledTimes(1);
    expect(resolveIdleState.execute).not.toHaveBeenCalled();
  });

  it.each([
    { resolveResult: true, expectedResult: true },
    { resolveResult: false, expectedResult: false }
  ])(
    'whenStateIsIdleAndResolverReturns$resolveResult_execute_shouldReturn$expectedResult',
    async ({ resolveResult, expectedResult }) => {
      // Arrange
      const stateMachine = createStateMachineMock();
      stateMachine.getCurrentState.mockReturnValue(ScraperState.IDLE);
      const resolveIdleState: ResolveIdleStateUseCaseMock = {
        execute: jest.fn(() => resolveResult)
      };
      const { useCase } = createUseCase({ stateMachine, resolveIdleState });
      const handlers = createHandlers();
      // Action
      const transitionProcessed = await useCase.execute(handlers);
      // Assert
      expect(transitionProcessed).toBe(expectedResult);
      expect(resolveIdleState.execute).toHaveBeenCalledTimes(1);
    }
  );

  it('whenStateIsUnknown_execute_shouldReturnFalseWithoutDelegatingToIdleResolver', async () => {
    // Arrange
    const stateMachine = createStateMachineMock();
    stateMachine.getCurrentState.mockReturnValue('UNKNOWN' as ScraperState);
    const { useCase, resolveIdleState } = createUseCase({ stateMachine });
    const handlers = createHandlers();
    // Action
    const transitionProcessed = await useCase.execute(handlers);
    // Assert
    expect(transitionProcessed).toBe(false);
    expect(resolveIdleState.execute).not.toHaveBeenCalled();
    expect(handlers.onScrapingForNewProperties).not.toHaveBeenCalled();
    expect(handlers.onUpdatingProperties).not.toHaveBeenCalled();
  });
});
