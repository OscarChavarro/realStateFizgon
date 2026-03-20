import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { RecoverFromBrowserFailureUseCase } from 'application/usecases/resilience/recover-from-browser-failure.use-case';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
class ChromeConfigMockForChromiumFailureGuardService {
  constructor(public readonly chromeCdpRequestTimeoutMs: number) {}
}

class ChromiumPageSyncServiceMockForChromiumFailureGuardService {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class RecoverFromBrowserFailureUseCaseMockForChromiumFailureGuardService {
  readonly execute = jest.fn<
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

type GuardParams = {
  reason: string;
  cdpHost: string;
  cdpPort: number;
  browserFailureRecoveryWaitMs: number;
  isShuttingDown: () => boolean;
  onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
};

function createGuard() {
  const chromeConfig = new ChromeConfigMockForChromiumFailureGuardService(25);
  const chromiumPageSyncService = new ChromiumPageSyncServiceMockForChromiumFailureGuardService();
  chromiumPageSyncService.sleep.mockResolvedValue(undefined);
  const recoverFromBrowserFailureUseCase = new RecoverFromBrowserFailureUseCaseMockForChromiumFailureGuardService();
  recoverFromBrowserFailureUseCase.execute.mockResolvedValue(undefined);
  const errorMessagePort: ErrorMessagePort = {
    toErrorMessage: jest.fn((error: unknown) => error instanceof Error ? error.message : String(error))
  };
  const service = new ChromiumFailureGuardService(
    chromeConfig as unknown as ChromeConfig,
    chromiumPageSyncService as unknown as ChromiumPageSyncService,
    recoverFromBrowserFailureUseCase as unknown as RecoverFromBrowserFailureUseCase,
    errorMessagePort
  );
  const logger = {
    error: jest.fn<(message: string) => void>(),
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: typeof logger }).logger = logger;

  const baseParams: GuardParams = {
    reason: 'failure',
    cdpHost: '127.0.0.1',
    cdpPort: 9222,
    browserFailureRecoveryWaitMs: 10000,
    isShuttingDown: () => false,
    onUnexpectedExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>()
  };

  return {
    service,
    logger,
    chromiumPageSyncService,
    recoverFromBrowserFailureUseCase,
    baseParams
  };
}

describe('ChromiumFailureGuardService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('whenShutdownIsRequested_handleUnexpectedChromeExit_shouldReturnWithoutRecovering', async () => {
    // Arrange
    const { service, logger } = createGuard();
    const cdpReachabilitySpy = jest.spyOn(
      service as unknown as {
        isCdpReachableAfterExit: (cdpHost: string, cdpPort: number) => Promise<boolean>;
      },
      'isCdpReachableAfterExit'
    );
    const recoverSpy = jest.spyOn(
      service as unknown as {
        recoverFromFailure: (params: GuardParams) => Promise<void>;
      },
      'recoverFromFailure'
    );
    // Action
    await service.handleUnexpectedChromeExit({
      code: 1,
      signal: 'SIGTERM',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 10000,
      isShuttingDown: () => true,
      onUnexpectedExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>()
    });
    // Assert
    expect(cdpReachabilitySpy).not.toHaveBeenCalled();
    expect(recoverSpy).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('whenCdpIsStillReachable_handleUnexpectedChromeExit_shouldLogAndSkipRecovery', async () => {
    // Arrange
    const { service, logger } = createGuard();
    jest.spyOn(
      service as unknown as {
        isCdpReachableAfterExit: (cdpHost: string, cdpPort: number) => Promise<boolean>;
      },
      'isCdpReachableAfterExit'
    ).mockResolvedValue(true);
    const recoverSpy = jest.spyOn(
      service as unknown as {
        recoverFromFailure: (params: GuardParams) => Promise<void>;
      },
      'recoverFromFailure'
    ).mockResolvedValue(undefined);
    // Action
    await service.handleUnexpectedChromeExit({
      code: null,
      signal: null,
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 10000,
      isShuttingDown: () => false,
      onUnexpectedExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>()
    });
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Chrome process exited unexpectedly (code=null, signal=null).');
    expect(logger.warn).toHaveBeenCalledWith(
      'Chrome launcher process exited, but CDP is still reachable. Continuing without shutting down.'
    );
    expect(recoverSpy).not.toHaveBeenCalled();
  });

  it('whenCdpIsNotReachable_handleUnexpectedChromeExit_shouldTriggerRecoveryFlow', async () => {
    // Arrange
    const { service, logger } = createGuard();
    jest.spyOn(
      service as unknown as {
        isCdpReachableAfterExit: (cdpHost: string, cdpPort: number) => Promise<boolean>;
      },
      'isCdpReachableAfterExit'
    ).mockResolvedValue(false);
    const recoverSpy = jest.spyOn(
      service as unknown as {
        recoverFromFailure: (params: GuardParams) => Promise<void>;
      },
      'recoverFromFailure'
    ).mockResolvedValue(undefined);
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    const isShuttingDown = (): boolean => false;
    // Action
    await service.handleUnexpectedChromeExit({
      code: 137,
      signal: 'SIGKILL',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 3210,
      isShuttingDown,
      onUnexpectedExit
    });
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Chrome process exited unexpectedly (code=137, signal=SIGKILL).');
    expect(recoverSpy).toHaveBeenCalledWith({
      reason: 'CDP connection to the browser was lost.',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 3210,
      isShuttingDown,
      onUnexpectedExit
    });
  });

  it('whenShutdownIsRequested_recoverFromFailure_shouldReturnEarly', async () => {
    // Arrange
    const { service, recoverFromBrowserFailureUseCase } = createGuard();
    // Action
    await service.recoverFromFailure({
      reason: 'x',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 10000,
      isShuttingDown: () => true,
      onUnexpectedExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>()
    });
    // Assert
    expect(recoverFromBrowserFailureUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenRecoveryIsAlreadyInProgress_recoverFromFailure_shouldLogAndSkipExecution', async () => {
    // Arrange
    const { service, logger, recoverFromBrowserFailureUseCase } = createGuard();
    (service as unknown as { recoveryInProgress: boolean }).recoveryInProgress = true;
    // Action
    await service.recoverFromFailure({
      reason: 'x',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 10000,
      isShuttingDown: () => false,
      onUnexpectedExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>()
    });
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'Browser recovery is already in progress; waiting for the active retry to finish.'
    );
    expect(recoverFromBrowserFailureUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenRecoverySucceeds_recoverFromFailure_shouldExecuteUseCaseAndResetFlag', async () => {
    // Arrange
    const { service, recoverFromBrowserFailureUseCase } = createGuard();
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    const isShuttingDown = (): boolean => false;
    // Action
    await service.recoverFromFailure({
      reason: 'ok',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 777,
      isShuttingDown,
      onUnexpectedExit
    });
    // Assert
    expect(recoverFromBrowserFailureUseCase.execute).toHaveBeenCalledWith({
      reason: 'ok',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 777,
      isShuttingDown,
      onUnexpectedExit
    });
    expect((service as unknown as { recoveryInProgress: boolean }).recoveryInProgress).toBe(false);
  });

  it('whenRecoveryThrows_recoverFromFailure_shouldLogErrorAndResetFlag', async () => {
    // Arrange
    const { service, logger, recoverFromBrowserFailureUseCase } = createGuard();
    recoverFromBrowserFailureUseCase.execute.mockRejectedValue(new Error('restart failed'));
    // Action
    await service.recoverFromFailure({
      reason: 'fail',
      cdpHost: '127.0.0.1',
      cdpPort: 9222,
      browserFailureRecoveryWaitMs: 777,
      isShuttingDown: () => false,
      onUnexpectedExit: jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>()
    });
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Browser restart failed: restart failed');
    expect((service as unknown as { recoveryInProgress: boolean }).recoveryInProgress).toBe(false);
  });

  it('whenCdpVersionEndpointRespondsOk_isCdpReachableAfterExit_shouldReturnTrueImmediately', async () => {
    // Arrange
    const { service, chromiumPageSyncService } = createGuard();
    const fetchMock = jest.fn<() => Promise<Response>>().mockResolvedValue({
      ok: true
    } as Response);
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    // Action
    const result = await (service as unknown as {
      isCdpReachableAfterExit: (cdpHost: string, cdpPort: number) => Promise<boolean>;
    }).isCdpReachableAfterExit('127.0.0.1', 9222);
    // Assert
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chromiumPageSyncService.sleep).not.toHaveBeenCalled();
  });

  it('whenCdpVersionEndpointKeepsFailing_isCdpReachableAfterExit_shouldRetryAndReturnFalse', async () => {
    // Arrange
    const { service, chromiumPageSyncService } = createGuard();
    const fetchMock = jest.fn<() => Promise<Response>>().mockResolvedValue({
      ok: false
    } as Response);
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    // Action
    const result = await (service as unknown as {
      isCdpReachableAfterExit: (cdpHost: string, cdpPort: number) => Promise<boolean>;
    }).isCdpReachableAfterExit('127.0.0.1', 9222);
    // Assert
    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(chromiumPageSyncService.sleep).toHaveBeenCalledTimes(5);
    expect(chromiumPageSyncService.sleep).toHaveBeenCalledWith(250);
  });

  it('whenFetchThrows_isCdpReachableAfterExit_shouldCatchAndContinueRetrying', async () => {
    // Arrange
    const { service, chromiumPageSyncService } = createGuard();
    const fetchMock = jest.fn<() => Promise<Response>>().mockRejectedValue(new Error('network down'));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    // Action
    const result = await (service as unknown as {
      isCdpReachableAfterExit: (cdpHost: string, cdpPort: number) => Promise<boolean>;
    }).isCdpReachableAfterExit('127.0.0.1', 9222);
    // Assert
    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(chromiumPageSyncService.sleep).toHaveBeenCalledTimes(5);
  });

  it('whenRequestTimeoutCallbackRuns_isCdpReachableAfterExit_shouldAbortAndRetry', async () => {
    // Arrange
    const { service, chromiumPageSyncService } = createGuard();
    jest.spyOn(globalThis, 'setTimeout').mockImplementation((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        handler();
      }
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    const fetchMock = jest.fn((_: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        return Promise.reject(new Error('aborted by timeout'));
      }
      return Promise.resolve({ ok: false } as Response);
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    // Action
    const result = await (service as unknown as {
      isCdpReachableAfterExit: (cdpHost: string, cdpPort: number) => Promise<boolean>;
    }).isCdpReachableAfterExit('127.0.0.1', 9222);
    // Assert
    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(chromiumPageSyncService.sleep).toHaveBeenCalledTimes(5);
  });
});
