import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumFailureGuardService } from 'src/application/services/chromium/chromium-failure-guard.service';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { RunScraperStateLoopUseCase } from 'src/application/usecases/state/run-scraper-state-loop.use-case';

type ScraperStateLoopHandlers = {
  onScrapingForNewProperties: () => Promise<void>;
  onUpdatingProperties: () => Promise<void>;
  onLoopError: (error: unknown) => Promise<void>;
  isShuttingDown: () => boolean;
};

class ScraperStateLoopServiceMockForRunScraperStateLoopUseCase {
  readonly start = jest.fn<(handlers: ScraperStateLoopHandlers) => void>();
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

function createUseCase() {
  const scraperStateLoopService = new ScraperStateLoopServiceMockForRunScraperStateLoopUseCase();
  const chromiumFailureGuardService = new ChromiumFailureGuardServiceMockForRunScraperStateLoopUseCase();
  chromiumFailureGuardService.recoverFromFailure.mockResolvedValue(undefined);
  const useCase = new RunScraperStateLoopUseCase(
    scraperStateLoopService as unknown as ScraperStateLoopService,
    chromiumFailureGuardService as unknown as ChromiumFailureGuardService
  );

  return {
    useCase,
    scraperStateLoopService,
    chromiumFailureGuardService
  };
}

describe('RunScraperStateLoopUseCase', () => {
  it('whenUseCaseExecutes_execute_shouldStartStateLoopWithGivenHandlers', async () => {
    // Arrange
    const { useCase, scraperStateLoopService } = createUseCase();
    const onScrapingForNewProperties = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onUpdatingProperties = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onAfterRecovery = jest.fn<() => void>();
    const isShuttingDown = (): boolean => false;
    const onUnexpectedChromeExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    useCase.execute({
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      isShuttingDown,
      onUnexpectedChromeExit,
      browserFailureRecoveryWaitMs: 10000,
      onScrapingForNewProperties,
      onUpdatingProperties,
      onAfterRecovery
    });
    // Assert
    expect(scraperStateLoopService.start).toHaveBeenCalledTimes(1);
    const handlers = scraperStateLoopService.start.mock.calls[0][0];
    expect(handlers.onScrapingForNewProperties).toBe(onScrapingForNewProperties);
    expect(handlers.onUpdatingProperties).toBe(onUpdatingProperties);
    expect(handlers.isShuttingDown).toBe(isShuttingDown);
    await handlers.onScrapingForNewProperties();
    await handlers.onUpdatingProperties();
    expect(onScrapingForNewProperties).toHaveBeenCalledTimes(1);
    expect(onUpdatingProperties).toHaveBeenCalledTimes(1);
  });

  it('whenLoopFails_onLoopError_shouldRecoverAndScheduleRestart', async () => {
    // Arrange
    const { useCase, scraperStateLoopService, chromiumFailureGuardService } = createUseCase();
    const onAfterRecovery = jest.fn<() => void>();
    const isShuttingDown = (): boolean => false;
    const onUnexpectedChromeExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    useCase.execute({
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      isShuttingDown,
      onUnexpectedChromeExit,
      browserFailureRecoveryWaitMs: 12345,
      onScrapingForNewProperties: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      onUpdatingProperties: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      onAfterRecovery
    });
    const handlers = scraperStateLoopService.start.mock.calls[0][0];
    // Action
    await handlers.onLoopError(new Error('boom'));
    // Assert
    expect(chromiumFailureGuardService.recoverFromFailure).toHaveBeenCalledWith({
      reason: 'Scraper state loop failed. boom',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 12345,
      isShuttingDown,
      onUnexpectedExit: onUnexpectedChromeExit
    });
    expect(onAfterRecovery).toHaveBeenCalledTimes(1);
  });
});
