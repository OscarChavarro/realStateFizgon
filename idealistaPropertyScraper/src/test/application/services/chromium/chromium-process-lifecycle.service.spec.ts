import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChromiumProcessLifecycleService } from 'application/services/chromium/chromium-process-lifecycle.service';
import { ChromiumUserAgentTlsService } from 'application/services/chromium/chromium-user-agent-tls.service';
import type {
  OperatingSystemProcessControlPort,
  OperatingSystemSpawnedProcess
} from 'ports/outbound/operating-system/operating-system-process-control.port';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import type { InputOutputFileAccessPort } from 'ports/outbound/input-output/input-output-file-access.port';
import type { InputOutputPathPort } from 'ports/outbound/input-output/input-output-path.port';

class ChromeConfigMockForProcessLifecycle {
  readonly chromePath = '/tmp/chrome-profile';
  readonly chromeBrowserLaunchRetryWaitMs = 500;
  readonly chromiumOptions = ['--headless=new', '--user-agent=from-options'];
  readonly chromeUserAgent = '';
}

class InputOutputPathPortMockForProcessLifecycle implements InputOutputPathPort {
  readonly join = jest.fn((...segments: string[]) => segments.join('/'));
  readonly resolve = jest.fn((...segments: string[]) => segments.join('/'));
}

class InputOutputFileAccessPortMockForProcessLifecycle implements InputOutputFileAccessPort {
  readonly fileExists = jest.fn<(path: string) => boolean>();
  readonly ensureDirectory = jest.fn<(path: string) => void>();
  readonly assertReadableWritable = jest.fn<(path: string) => void>();
  readonly writeTextFile = jest.fn<(path: string, content: string) => void>();
  readonly deleteFile = jest.fn<(path: string) => void>();
  readonly openFileForAppend = jest.fn<(path: string) => number>();
  readonly closeFileDescriptor = jest.fn<(fileDescriptor: number) => void>();
  readonly pathExists = jest.fn<(path: string) => Promise<boolean>>();
}

class ChromiumUserAgentTlsServiceMockForProcessLifecycle {
  readonly resolveBrowserBinary = jest.fn<(logger: unknown) => string>();
  readonly getBrowserVersion = jest.fn<(browserBinary: string, logger?: unknown) => string | undefined>();
  readonly resolveUserAgentForLaunch = jest.fn<(
    requestedUserAgent: string,
    browserVersion: string | undefined,
    logger?: unknown
  ) => string | undefined>();
}

type SleepPortMock = {
  sleep: jest.Mock<(ms: number) => Promise<void>>;
};

type ErrorMessagePortMock = {
  toErrorMessage: jest.Mock<(error: unknown) => string>;
};

type FakeProcess = OperatingSystemSpawnedProcess;

function createSpawnSuccessProcess(pid?: number): {
  process: FakeProcess;
  exitHandlerRef: { handler?: (code: number | null, signal: NodeJS.Signals | null) => void };
} {
  const exitHandlerRef: { handler?: (code: number | null, signal: NodeJS.Signals | null) => void } = {};
  const process: FakeProcess = {
    pid,
    killed: false,
    once: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (event === 'spawn') {
        callback();
      } else if (event === 'exit') {
        exitHandlerRef.handler = callback as (code: number | null, signal: NodeJS.Signals | null) => void;
      }
      return process;
    }),
    kill: jest.fn()
  };
  return { process, exitHandlerRef };
}

function createSpawnErrorProcess(error: Error & { code?: string }): FakeProcess {
  const process: FakeProcess = {
    pid: 777,
    killed: false,
    once: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (event === 'error') {
        callback(error);
      }
      return process;
    }),
    kill: jest.fn()
  };
  return process;
}

function createService() {
  const chromeConfig = new ChromeConfigMockForProcessLifecycle();
  const chromiumUserAgentTlsService = new ChromiumUserAgentTlsServiceMockForProcessLifecycle();
  const inputOutputPathPort = new InputOutputPathPortMockForProcessLifecycle();
  const inputOutputFileAccessPort = new InputOutputFileAccessPortMockForProcessLifecycle();
  chromiumUserAgentTlsService.resolveBrowserBinary.mockReturnValue('/usr/bin/chromium');
  chromiumUserAgentTlsService.getBrowserVersion.mockReturnValue('145.0.7420.0');
  chromiumUserAgentTlsService.resolveUserAgentForLaunch.mockReturnValue('Mozilla Chrome/145.0.7420.0');
  const errorMessagePort: ErrorMessagePortMock = {
    toErrorMessage: jest.fn((error: unknown) => (error instanceof Error ? error.message : String(error)))
  };
  const sleepPort: SleepPortMock = {
    sleep: jest.fn(async () => undefined)
  };
  const operatingSystemProcessControlPort: jest.Mocked<OperatingSystemProcessControlPort> = {
    spawn: jest.fn(),
    spawnSync: jest.fn(),
    canAccessPath: jest.fn(),
    isPidAlive: jest.fn(),
    killPid: jest.fn()
  };
  const service = new ChromiumProcessLifecycleService(
    chromeConfig as unknown as ChromeSettingsPort,
    inputOutputPathPort,
    inputOutputFileAccessPort,
    chromiumUserAgentTlsService as unknown as ChromiumUserAgentTlsService,
    errorMessagePort as never,
    operatingSystemProcessControlPort,
    sleepPort as never
  );
  const logger = {
    error: jest.fn<(message: string) => void>(),
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: typeof logger }).logger = logger;
  return {
    service,
    chromeConfig,
    chromiumUserAgentTlsService,
    logger,
    errorMessagePort,
    sleepPort,
    operatingSystemProcessControlPort,
    inputOutputPathPort,
    inputOutputFileAccessPort
  };
}

describe('ChromiumProcessLifecycleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenLaunchSucceeds_launchChromiumProcess_shouldSpawnChromiumAndRegisterExitHandler', async () => {
    // Arrange
    const { service, chromiumUserAgentTlsService, logger, operatingSystemProcessControlPort, inputOutputFileAccessPort } = createService();
    const spawnMock = operatingSystemProcessControlPort.spawn;
    const { process, exitHandlerRef } = createSpawnSuccessProcess(1234);
    spawnMock.mockReturnValue(process);
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    inputOutputFileAccessPort.openFileForAppend.mockReturnValueOnce(10).mockReturnValueOnce(11);
    // Action
    await service.launchChromiumProcess(9222, onUnexpectedExit, () => false);
    exitHandlerRef.handler?.(1, 'SIGTERM');
    // Assert
    expect(inputOutputFileAccessPort.ensureDirectory).toHaveBeenCalledWith(expect.stringContaining('output/logs'));
    expect(chromiumUserAgentTlsService.resolveBrowserBinary).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      '/usr/bin/chromium',
      expect.arrayContaining([
        '--remote-debugging-port=9222',
        '--user-data-dir=/tmp/chrome-profile',
        '--headless=new',
        '--user-agent=Mozilla Chrome/145.0.7420.0',
        'about:blank'
      ]),
      expect.objectContaining({ stdio: ['ignore', 10, 11] })
    );
    expect(logger.log).toHaveBeenCalledWith('Chrome process started with PID 1234.');
    expect(onUnexpectedExit).toHaveBeenCalledWith(1, 'SIGTERM');
    expect(inputOutputFileAccessPort.closeFileDescriptor).toHaveBeenCalledWith(10);
    expect(inputOutputFileAccessPort.closeFileDescriptor).toHaveBeenCalledWith(11);
  });

  it('whenSpawnedProcessHasNoPid_launchChromiumProcess_shouldLogUnknownPid', async () => {
    // Arrange
    const { service, logger, operatingSystemProcessControlPort, inputOutputFileAccessPort } = createService();
    const spawnMock = operatingSystemProcessControlPort.spawn;
    const { process } = createSpawnSuccessProcess(undefined);
    spawnMock.mockReturnValue(process);
    inputOutputFileAccessPort.openFileForAppend.mockReturnValueOnce(12).mockReturnValueOnce(13);
    // Action
    await service.launchChromiumProcess(9000, jest.fn(), () => false);
    // Assert
    expect(logger.log).toHaveBeenCalledWith('Chrome process started with PID unknown.');
  });

  it('whenSpawnFailsWithEnoent_launchChromiumProcess_shouldRetryAfterSleep', async () => {
    // Arrange
    const { service, logger, sleepPort, operatingSystemProcessControlPort, inputOutputFileAccessPort } = createService();
    const spawnMock = operatingSystemProcessControlPort.spawn;
    const error = new Error('missing') as Error & { code?: string };
    error.code = 'ENOENT';
    const failingProcess = createSpawnErrorProcess(error);
    const { process: succeedingProcess } = createSpawnSuccessProcess(5678);
    spawnMock.mockReturnValueOnce(failingProcess).mockReturnValueOnce(succeedingProcess);
    inputOutputFileAccessPort.openFileForAppend
      .mockReturnValueOnce(20).mockReturnValueOnce(21)
      .mockReturnValueOnce(22).mockReturnValueOnce(23);
    // Action
    await service.launchChromiumProcess(9555, jest.fn(), () => false);
    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      'Browser binary "/usr/bin/chromium" was not found. Waiting 0 seconds before retrying launch.'
    );
    expect(sleepPort.sleep).toHaveBeenCalledWith(500);
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(inputOutputFileAccessPort.closeFileDescriptor).toHaveBeenCalledWith(20);
    expect(inputOutputFileAccessPort.closeFileDescriptor).toHaveBeenCalledWith(21);
  });

  it('whenSpawnFailsWithUnexpectedError_launchChromiumProcess_shouldPropagateError', async () => {
    // Arrange
    const { service, sleepPort, operatingSystemProcessControlPort, inputOutputFileAccessPort } = createService();
    const spawnMock = operatingSystemProcessControlPort.spawn;
    const error = new Error('spawn-failed');
    spawnMock.mockReturnValue(createSpawnErrorProcess(error));
    inputOutputFileAccessPort.openFileForAppend.mockReturnValueOnce(30).mockReturnValueOnce(31);
    // Action
    const action = service.launchChromiumProcess(9223, jest.fn(), () => false);
    // Assert
    await expect(action).rejects.toThrow('spawn-failed');
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenServiceIsAlreadyShuttingDown_launchChromiumProcess_shouldAbortLaunch', async () => {
    // Arrange
    const { service, operatingSystemProcessControlPort, inputOutputFileAccessPort } = createService();
    // Action
    const action = service.launchChromiumProcess(9224, jest.fn(), () => true);
    // Assert
    await expect(action).rejects.toThrow('Chrome launch aborted because the service is shutting down.');
    expect(operatingSystemProcessControlPort.spawn).not.toHaveBeenCalled();
  });

  it('whenStopIsRequestedWithAlivePid_stopChromiumProcess_shouldSendSigtermAndCloseLogs', () => {
    // Arrange
    const { service, operatingSystemProcessControlPort, inputOutputFileAccessPort } = createService();
    const fakeProcess: FakeProcess = {
      pid: 7001,
      killed: false,
      once: jest.fn() as unknown as FakeProcess['once'],
      kill: jest.fn() as unknown as FakeProcess['kill']
    };
    (service as unknown as { chromeProcess?: FakeProcess }).chromeProcess = fakeProcess;
    (service as unknown as { chromeStdoutFd?: number }).chromeStdoutFd = 40;
    (service as unknown as { chromeStderrFd?: number }).chromeStderrFd = 41;
    operatingSystemProcessControlPort.isPidAlive.mockReturnValue(true);
    // Action
    service.stopChromiumProcess();
    // Assert
    expect(fakeProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect((service as unknown as { controlledStopInProgress: boolean }).controlledStopInProgress).toBe(true);
    expect(inputOutputFileAccessPort.closeFileDescriptor).toHaveBeenCalledWith(40);
    expect(inputOutputFileAccessPort.closeFileDescriptor).toHaveBeenCalledWith(41);
  });

  it('whenExitHappensAfterControlledStop_launchChromiumProcess_shouldResetStopFlagWithoutUnexpectedExitCallback', async () => {
    // Arrange
    const { service, operatingSystemProcessControlPort, inputOutputFileAccessPort } = createService();
    const spawnMock = operatingSystemProcessControlPort.spawn;
    const { process, exitHandlerRef } = createSpawnSuccessProcess(7010);
    spawnMock.mockReturnValue(process);
    inputOutputFileAccessPort.openFileForAppend.mockReturnValueOnce(14).mockReturnValueOnce(15);
    const onUnexpectedExit = jest.fn<(code: number | null, signal: NodeJS.Signals | null) => void>();
    // Action
    await service.launchChromiumProcess(9001, onUnexpectedExit, () => false);
    (service as unknown as { controlledStopInProgress: boolean }).controlledStopInProgress = true;
    exitHandlerRef.handler?.(0, null);
    // Assert
    expect((service as unknown as { controlledStopInProgress: boolean }).controlledStopInProgress).toBe(false);
    expect(onUnexpectedExit).not.toHaveBeenCalled();
  });

  it('whenStopIsRequestedForKilledProcess_stopChromiumProcess_shouldSkipSigterm', () => {
    // Arrange
    const { service } = createService();
    const fakeProcess: FakeProcess = {
      pid: 7002,
      killed: true,
      once: jest.fn() as unknown as FakeProcess['once'],
      kill: jest.fn() as unknown as FakeProcess['kill']
    };
    (service as unknown as { chromeProcess?: FakeProcess }).chromeProcess = fakeProcess;
    // Action
    service.stopChromiumProcess();
    // Assert
    expect(fakeProcess.kill).not.toHaveBeenCalled();
  });

  it('whenForceKillHasNoPid_forceKillChromiumProcess_shouldReturnEarly', () => {
    // Arrange
    const { service, operatingSystemProcessControlPort } = createService();
    (service as unknown as { chromeProcess?: FakeProcess }).chromeProcess = {
      pid: undefined,
      killed: false,
      once: jest.fn() as unknown as FakeProcess['once'],
      kill: jest.fn() as unknown as FakeProcess['kill']
    };
    // Action
    service.forceKillChromiumProcess();
    // Assert
    expect(operatingSystemProcessControlPort.killPid).not.toHaveBeenCalled();
  });

  it('whenForceKillTargetIsDead_forceKillChromiumProcess_shouldSkipSigkill', () => {
    // Arrange
    const { service, operatingSystemProcessControlPort } = createService();
    (service as unknown as { chromeProcess?: FakeProcess }).chromeProcess = {
      pid: 8001,
      killed: false,
      once: jest.fn() as unknown as FakeProcess['once'],
      kill: jest.fn() as unknown as FakeProcess['kill']
    };
    operatingSystemProcessControlPort.isPidAlive.mockReturnValue(false);
    // Action
    service.forceKillChromiumProcess();
    // Assert
    expect(operatingSystemProcessControlPort.killPid).not.toHaveBeenCalledWith(8001, 'SIGKILL');
  });

  it('whenForceKillSucceeds_forceKillChromiumProcess_shouldSendSigkillAndWarn', () => {
    // Arrange
    const { service, logger, operatingSystemProcessControlPort } = createService();
    (service as unknown as { chromeProcess?: FakeProcess }).chromeProcess = {
      pid: 8002,
      killed: false,
      once: jest.fn() as unknown as FakeProcess['once'],
      kill: jest.fn() as unknown as FakeProcess['kill']
    };
    operatingSystemProcessControlPort.isPidAlive.mockReturnValue(true);
    // Action
    service.forceKillChromiumProcess();
    // Assert
    expect(operatingSystemProcessControlPort.killPid).toHaveBeenCalledWith(8002, 'SIGKILL');
    expect(logger.warn).toHaveBeenCalledWith('Sent SIGKILL to Chrome process PID 8002.');
  });

  it('whenForceKillFails_forceKillChromiumProcess_shouldWarnWithErrorMessage', () => {
    // Arrange
    const { service, logger, operatingSystemProcessControlPort } = createService();
    (service as unknown as { chromeProcess?: FakeProcess }).chromeProcess = {
      pid: 8003,
      killed: false,
      once: jest.fn() as unknown as FakeProcess['once'],
      kill: jest.fn() as unknown as FakeProcess['kill']
    };
    operatingSystemProcessControlPort.isPidAlive.mockReturnValue(true);
    operatingSystemProcessControlPort.killPid.mockImplementation(() => {
      throw new Error('permission denied');
    });
    // Action
    service.forceKillChromiumProcess();
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to send SIGKILL to Chrome process PID 8003. permission denied'
    );
  });

  it('whenResolvedUserAgentIsEmpty_resolveChromiumOptions_shouldNotAppendUserAgentFlag', () => {
    // Arrange
    const { service, chromiumUserAgentTlsService } = createService();
    chromiumUserAgentTlsService.resolveUserAgentForLaunch.mockReturnValue(undefined);
    // Action
    const options = (service as unknown as { resolveChromiumOptions: (browserBinary: string) => string[] })
      .resolveChromiumOptions('/usr/bin/chromium');
    // Assert
    expect(options).toEqual(['--headless=new']);
  });

  it('whenChromeUserAgentIsConfigured_resolveChromiumOptions_shouldPreferConfiguredUserAgent', () => {
    // Arrange
    const { service, chromeConfig, chromiumUserAgentTlsService } = createService();
    (chromeConfig as { chromeUserAgent: string }).chromeUserAgent = 'Configured-UA';
    // Action
    (service as unknown as { resolveChromiumOptions: (browserBinary: string) => string[] })
      .resolveChromiumOptions('/usr/bin/chromium');
    // Assert
    expect(chromiumUserAgentTlsService.resolveUserAgentForLaunch).toHaveBeenCalledWith(
      'Configured-UA',
      '145.0.7420.0',
      expect.any(Object)
    );
  });

  it('whenUserAgentMustBeReadFromOptions_extractUserAgentOption_shouldReturnLastConfiguredValue', () => {
    // Arrange
    const { service } = createService();
    // Action
    const value = (service as unknown as { extractUserAgentOption: (options: string[]) => string }).extractUserAgentOption([
      '--headless=new',
      '--user-agent=first',
      '--foo',
      '--user-agent=last'
    ]);
    // Assert
    expect(value).toBe('last');
  });

  it('whenUserAgentOptionDoesNotExist_extractUserAgentOption_shouldReturnEmptyString', () => {
    // Arrange
    const { service } = createService();
    // Action
    const value = (service as unknown as { extractUserAgentOption: (options: string[]) => string }).extractUserAgentOption([
      '--headless=new'
    ]);
    // Assert
    expect(value).toBe('');
  });

  it('whenErrorCodeOrMessageContainsEnoent_isBrowserBinaryMissingError_shouldReturnTrueOtherwiseFalse', () => {
    // Arrange
    const { service } = createService();
    // Action
    const byCode = (service as unknown as { isBrowserBinaryMissingError: (error: unknown) => boolean })
      .isBrowserBinaryMissingError({ code: 'ENOENT' });
    const byMessage = (service as unknown as { isBrowserBinaryMissingError: (error: unknown) => boolean })
      .isBrowserBinaryMissingError(new Error('spawn ENOENT happened'));
    const nonMatch = (service as unknown as { isBrowserBinaryMissingError: (error: unknown) => boolean })
      .isBrowserBinaryMissingError(new Error('boom'));
    // Assert
    expect(byCode).toBe(true);
    expect(byMessage).toBe(true);
    expect(nonMatch).toBe(false);
  });

  it('whenProcessKillProbeSucceeds_isPidAlive_shouldReturnTrue', () => {
    // Arrange
    const { service, operatingSystemProcessControlPort } = createService();
    operatingSystemProcessControlPort.isPidAlive.mockReturnValue(true);
    // Action
    const alive = (service as unknown as { isPidAlive: (pid: number) => boolean }).isPidAlive(123);
    // Assert
    expect(alive).toBe(true);
    expect(operatingSystemProcessControlPort.isPidAlive).toHaveBeenCalledWith(123);
  });
});
