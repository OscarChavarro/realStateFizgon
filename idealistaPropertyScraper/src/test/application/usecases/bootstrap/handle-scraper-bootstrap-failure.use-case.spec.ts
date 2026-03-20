import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { ScraperOrchestratorService } from 'application/services/scraper/scraper-orchestrator.service';
import { HandleScraperBootstrapFailureUseCase } from 'application/usecases/bootstrap/handle-scraper-bootstrap-failure.use-case';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

class ChromiumFailureGuardServiceMockForHandleScraperBootstrapFailureUseCase {
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

class ScraperOrchestratorServiceMockForHandleScraperBootstrapFailureUseCase {
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

class ErrorMessagePortMockForHandleScraperBootstrapFailureUseCase implements ErrorMessagePort {
  readonly toErrorMessage = jest.fn<(error: unknown) => string>();
}

function createUseCase() {
  const chromiumFailureGuardService = new ChromiumFailureGuardServiceMockForHandleScraperBootstrapFailureUseCase();
  chromiumFailureGuardService.recoverFromFailure.mockResolvedValue(undefined);
  const scraperOrchestratorService = new ScraperOrchestratorServiceMockForHandleScraperBootstrapFailureUseCase();
  const errorMessagePort = new ErrorMessagePortMockForHandleScraperBootstrapFailureUseCase();
  errorMessagePort.toErrorMessage.mockImplementation((error: unknown) =>
    error instanceof Error ? error.message : String(error)
  );
  const useCase = new HandleScraperBootstrapFailureUseCase(
    chromiumFailureGuardService as unknown as ChromiumFailureGuardService,
    scraperOrchestratorService as unknown as ScraperOrchestratorService,
    errorMessagePort
  );

  return {
    useCase,
    chromiumFailureGuardService,
    scraperOrchestratorService,
    errorMessagePort
  };
}

describe('HandleScraperBootstrapFailureUseCase', () => {
  it('whenFailureIsHandledAndServiceKeepsRunning_execute_shouldRecoverAndRestartOrchestrator', async () => {
    // Arrange
    const { useCase, chromiumFailureGuardService, scraperOrchestratorService, errorMessagePort } = createUseCase();
    const isShuttingDown = (): boolean => false;
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await useCase.execute({
      error: 'boom-string',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 10000,
      isShuttingDown,
      onUnexpectedExit
    });
    // Assert
    expect(errorMessagePort.toErrorMessage).toHaveBeenCalledWith('boom-string');
    expect(chromiumFailureGuardService.recoverFromFailure).toHaveBeenCalledWith({
      reason: 'Browser startup flow failed. boom-string',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 10000,
      isShuttingDown,
      onUnexpectedExit
    });
    expect(scraperOrchestratorService.start).toHaveBeenCalledWith({
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      isShuttingDown,
      onUnexpectedChromeExit: onUnexpectedExit,
      browserFailureRecoveryWaitMs: 10000
    });
  });

  it('whenFailureIsHandledAndShutdownWasRequested_execute_shouldRecoverWithoutRestartingOrchestrator', async () => {
    // Arrange
    const { useCase, chromiumFailureGuardService, scraperOrchestratorService, errorMessagePort } = createUseCase();
    const isShuttingDown = (): boolean => true;
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await useCase.execute({
      error: new Error('fatal'),
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      browserFailureRecoveryWaitMs: 20000,
      isShuttingDown,
      onUnexpectedExit
    });
    // Assert
    expect(errorMessagePort.toErrorMessage).toHaveBeenCalledWith(expect.any(Error));
    expect(chromiumFailureGuardService.recoverFromFailure).toHaveBeenCalledWith({
      reason: 'Browser startup flow failed. fatal',
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      browserFailureRecoveryWaitMs: 20000,
      isShuttingDown,
      onUnexpectedExit
    });
    expect(scraperOrchestratorService.start).not.toHaveBeenCalled();
  });
});
