import { describe, expect, it, jest } from '@jest/globals';
import { HomeSearchPreparationFlowService } from 'src/application/services/bootstrap/home-search-preparation-flow.service';
import { ChromiumFailureGuardService } from 'src/application/services/chromium/chromium-failure-guard.service';
import { ScraperOrchestratorService } from 'src/application/services/scraper/scraper-orchestrator.service';
import { BootstrapChromiumSessionUseCase } from 'src/application/usecases/bootstrap/bootstrap-chromium-session.use-case';
import { InitializeScraperBootstrapUseCase } from 'src/application/usecases/bootstrap/initialize-scraper-bootstrap.use-case';
import { RunStartupPreChecksUseCase } from 'src/application/usecases/prechecks/run-startup-pre-checks.use-case';

class ChromiumFailureGuardServiceMockForInitializeScraperBootstrapUseCase {
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

class RunStartupPreChecksUseCaseMockForInitializeScraperBootstrapUseCase {
  readonly execute = jest.fn<() => Promise<void>>();
}

class HomeSearchPreparationFlowServiceMockForInitializeScraperBootstrapUseCase {
  readonly execute = jest.fn<(cdpHost: string, cdpPort: number) => Promise<void>>();
}

class ScraperOrchestratorServiceMockForInitializeScraperBootstrapUseCase {
  readonly start = jest.fn<
    (params: {
      cdpHost: string;
      cdpPort: number;
      isShuttingDown: () => boolean;
      onUnexpectedChromeExit: (code: number | null, signal: NodeJS.Signals | null) => void;
      browserFailureRecoveryWaitMs: number;
    }) => void
  >();
}

class BootstrapChromiumSessionUseCaseMockForInitializeScraperBootstrapUseCase {
  readonly execute = jest.fn<
    (params: {
      cdpHost: string;
      cdpPort: number;
      onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
      isShuttingDown: () => boolean;
    }) => Promise<void>
  >();
}

function createUseCase() {
  const chromiumFailureGuardService = new ChromiumFailureGuardServiceMockForInitializeScraperBootstrapUseCase();
  chromiumFailureGuardService.recoverFromFailure.mockResolvedValue(undefined);
  const runStartupPreChecksUseCase = new RunStartupPreChecksUseCaseMockForInitializeScraperBootstrapUseCase();
  runStartupPreChecksUseCase.execute.mockResolvedValue(undefined);
  const homeSearchPreparationFlowService = new HomeSearchPreparationFlowServiceMockForInitializeScraperBootstrapUseCase();
  homeSearchPreparationFlowService.execute.mockResolvedValue(undefined);
  const scraperOrchestratorService = new ScraperOrchestratorServiceMockForInitializeScraperBootstrapUseCase();
  const bootstrapChromiumSessionUseCase = new BootstrapChromiumSessionUseCaseMockForInitializeScraperBootstrapUseCase();
  bootstrapChromiumSessionUseCase.execute.mockResolvedValue(undefined);
  const useCase = new InitializeScraperBootstrapUseCase(
    chromiumFailureGuardService as unknown as ChromiumFailureGuardService,
    runStartupPreChecksUseCase as unknown as RunStartupPreChecksUseCase,
    homeSearchPreparationFlowService as unknown as HomeSearchPreparationFlowService,
    scraperOrchestratorService as unknown as ScraperOrchestratorService,
    bootstrapChromiumSessionUseCase as unknown as BootstrapChromiumSessionUseCase
  );

  return {
    useCase,
    chromiumFailureGuardService,
    runStartupPreChecksUseCase,
    homeSearchPreparationFlowService,
    scraperOrchestratorService,
    bootstrapChromiumSessionUseCase
  };
}

describe('InitializeScraperBootstrapUseCase', () => {
  it('whenStartupFlowSucceeds_execute_shouldBootstrapAndStartOrchestrator', async () => {
    // Arrange
    const {
      useCase,
      chromiumFailureGuardService,
      runStartupPreChecksUseCase,
      homeSearchPreparationFlowService,
      scraperOrchestratorService,
      bootstrapChromiumSessionUseCase
    } = createUseCase();
    const isShuttingDown = (): boolean => false;
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await useCase.execute({
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 10000,
      isShuttingDown,
      onUnexpectedExit
    });
    // Assert
    expect(runStartupPreChecksUseCase.execute).toHaveBeenCalledTimes(1);
    expect(bootstrapChromiumSessionUseCase.execute).toHaveBeenCalledWith({
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      onUnexpectedExit,
      isShuttingDown
    });
    expect(homeSearchPreparationFlowService.execute).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(scraperOrchestratorService.start).toHaveBeenCalledWith({
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      isShuttingDown,
      onUnexpectedChromeExit: onUnexpectedExit,
      browserFailureRecoveryWaitMs: 10000
    });
    expect(chromiumFailureGuardService.recoverFromFailure).not.toHaveBeenCalled();
  });

  it('whenStartupFlowFailsAndServiceKeepsRunning_execute_shouldRecoverAndStartOrchestrator', async () => {
    // Arrange
    const {
      useCase,
      chromiumFailureGuardService,
      runStartupPreChecksUseCase,
      homeSearchPreparationFlowService,
      scraperOrchestratorService,
      bootstrapChromiumSessionUseCase
    } = createUseCase();
    runStartupPreChecksUseCase.execute.mockRejectedValue('boom-string');
    const isShuttingDown = (): boolean => false;
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await useCase.execute({
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      browserFailureRecoveryWaitMs: 20000,
      isShuttingDown,
      onUnexpectedExit
    });
    // Assert
    expect(chromiumFailureGuardService.recoverFromFailure).toHaveBeenCalledWith({
      reason: 'Browser startup flow failed. boom-string',
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      browserFailureRecoveryWaitMs: 20000,
      isShuttingDown,
      onUnexpectedExit
    });
    expect(scraperOrchestratorService.start).toHaveBeenCalledWith({
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      isShuttingDown,
      onUnexpectedChromeExit: onUnexpectedExit,
      browserFailureRecoveryWaitMs: 20000
    });
    expect(bootstrapChromiumSessionUseCase.execute).not.toHaveBeenCalled();
    expect(homeSearchPreparationFlowService.execute).not.toHaveBeenCalled();
  });

  it('whenStartupFlowFailsAndShutdownWasRequested_execute_shouldRecoverWithoutRestartingOrchestrator', async () => {
    // Arrange
    const { useCase, chromiumFailureGuardService, runStartupPreChecksUseCase, scraperOrchestratorService } = createUseCase();
    runStartupPreChecksUseCase.execute.mockRejectedValue(new Error('fatal'));
    const isShuttingDown = (): boolean => true;
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await useCase.execute({
      cdpHost: '127.0.0.1',
      cdpPort: 9444,
      browserFailureRecoveryWaitMs: 30000,
      isShuttingDown,
      onUnexpectedExit
    });
    // Assert
    expect(chromiumFailureGuardService.recoverFromFailure).toHaveBeenCalledWith({
      reason: 'Browser startup flow failed. fatal',
      cdpHost: '127.0.0.1',
      cdpPort: 9444,
      browserFailureRecoveryWaitMs: 30000,
      isShuttingDown,
      onUnexpectedExit
    });
    expect(scraperOrchestratorService.start).not.toHaveBeenCalled();
  });
});
