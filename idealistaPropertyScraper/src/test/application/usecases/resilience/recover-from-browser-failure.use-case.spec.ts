import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumCdpReadinessService } from 'src/application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/chromium/chromium-process-lifecycle.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { RecoverFromBrowserFailureUseCase } from 'src/application/usecases/resilience/recover-from-browser-failure.use-case';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

class ChromiumPageSyncServiceMockForRecoverFromBrowserFailureUseCase {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class ChromiumProcessLifecycleServiceMockForRecoverFromBrowserFailureUseCase {
  readonly stopChromiumProcess = jest.fn<() => void>();
  readonly forceKillChromiumProcess = jest.fn<() => void>();
  readonly launchChromiumProcess = jest.fn<(
    cdpPort: number,
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void,
    isShuttingDown: () => boolean
  ) => Promise<void>>();
}

class ChromiumCdpReadinessServiceMockForRecoverFromBrowserFailureUseCase {
  readonly waitForReadyEndpoint = jest.fn<(host: string, port: number) => Promise<void>>();
}

class ChromiumGeolocationServiceMockForRecoverFromBrowserFailureUseCase {
  readonly grantStartupPermissions = jest.fn<(host: string, port: number) => Promise<void>>();
}

class ScraperStateMachineServiceMockForRecoverFromBrowserFailureUseCase {
  readonly setState = jest.fn<(state: ScraperState) => void>();
}

function createUseCase() {
  const chromiumPageSyncService = new ChromiumPageSyncServiceMockForRecoverFromBrowserFailureUseCase();
  chromiumPageSyncService.sleep.mockResolvedValue(undefined);
  const chromiumProcessLifecycleService = new ChromiumProcessLifecycleServiceMockForRecoverFromBrowserFailureUseCase();
  chromiumProcessLifecycleService.launchChromiumProcess.mockResolvedValue(undefined);
  const chromiumCdpReadinessService = new ChromiumCdpReadinessServiceMockForRecoverFromBrowserFailureUseCase();
  chromiumCdpReadinessService.waitForReadyEndpoint.mockResolvedValue(undefined);
  const chromiumGeolocationService = new ChromiumGeolocationServiceMockForRecoverFromBrowserFailureUseCase();
  chromiumGeolocationService.grantStartupPermissions.mockResolvedValue(undefined);
  const scraperStateMachineService = new ScraperStateMachineServiceMockForRecoverFromBrowserFailureUseCase();
  const useCase = new RecoverFromBrowserFailureUseCase(
    chromiumPageSyncService as unknown as ChromiumPageSyncService,
    chromiumProcessLifecycleService as unknown as ChromiumProcessLifecycleService,
    chromiumCdpReadinessService as unknown as ChromiumCdpReadinessService,
    chromiumGeolocationService as unknown as ChromiumGeolocationService,
    scraperStateMachineService as unknown as ScraperStateMachineService
  );
  const logger = {
    error: jest.fn<(message: string) => void>(),
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;
  return {
    useCase,
    chromiumPageSyncService,
    chromiumProcessLifecycleService,
    chromiumCdpReadinessService,
    chromiumGeolocationService,
    scraperStateMachineService,
    logger
  };
}

describe('RecoverFromBrowserFailureUseCase', () => {
  it('whenBrowserRecoveryIsSuccessful_execute_shouldRestartAndSetIdle', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageSyncService,
      chromiumProcessLifecycleService,
      chromiumCdpReadinessService,
      chromiumGeolocationService,
      scraperStateMachineService,
      logger
    } = createUseCase();
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await useCase.execute({
      reason: 'state loop failed',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 2100,
      isShuttingDown: () => false,
      onUnexpectedExit
    });
    // Assert
    expect(chromiumProcessLifecycleService.stopChromiumProcess).toHaveBeenCalledTimes(1);
    expect(chromiumPageSyncService.sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(chromiumProcessLifecycleService.forceKillChromiumProcess).toHaveBeenCalledTimes(1);
    expect(chromiumPageSyncService.sleep).toHaveBeenNthCalledWith(2, 2100);
    expect(chromiumProcessLifecycleService.launchChromiumProcess).toHaveBeenCalledWith(9222, onUnexpectedExit, expect.any(Function));
    expect(chromiumCdpReadinessService.waitForReadyEndpoint).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(chromiumGeolocationService.grantStartupPermissions).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(scraperStateMachineService.setState).toHaveBeenCalledWith(ScraperState.IDLE);
    expect(logger.error).toHaveBeenCalledWith('Browser failure detected: state loop failed');
    expect(logger.error).toHaveBeenCalledWith('Browser will be restarted after waiting 2 seconds.');
    expect(logger.log).toHaveBeenCalledWith('Browser restart completed. Scraper state was set to IDLE.');
  });

  it('whenShutdownFlagIsRaisedAfterWait_execute_shouldStopBeforeRelaunch', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageSyncService,
      chromiumProcessLifecycleService,
      chromiumCdpReadinessService,
      chromiumGeolocationService,
      scraperStateMachineService
    } = createUseCase();
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await useCase.execute({
      reason: 'shutdown',
      cdpHost: '127.0.0.1',
      cdpPort: 9333,
      browserFailureRecoveryWaitMs: 5000,
      isShuttingDown: () => true,
      onUnexpectedExit
    });
    // Assert
    expect(chromiumProcessLifecycleService.stopChromiumProcess).toHaveBeenCalledTimes(1);
    expect(chromiumProcessLifecycleService.forceKillChromiumProcess).toHaveBeenCalledTimes(1);
    expect(chromiumPageSyncService.sleep).toHaveBeenNthCalledWith(2, 5000);
    expect(chromiumProcessLifecycleService.launchChromiumProcess).not.toHaveBeenCalled();
    expect(chromiumCdpReadinessService.waitForReadyEndpoint).not.toHaveBeenCalled();
    expect(chromiumGeolocationService.grantStartupPermissions).not.toHaveBeenCalled();
    expect(scraperStateMachineService.setState).not.toHaveBeenCalled();
  });
});
