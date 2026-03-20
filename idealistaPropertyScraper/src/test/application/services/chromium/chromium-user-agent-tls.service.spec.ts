import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChromiumUserAgentTlsService } from 'application/services/chromium/chromium-user-agent-tls.service';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import type { OperatingSystemProcessControlPort } from 'ports/outbound/operating-system/operating-system-process-control.port';
import { LoggerLikeMock } from '../../../support/mocks/logger-like.mock';

class ChromeConfigMockForUserAgent {
  constructor(public readonly chromeBinary: string) {}
}

function createErrorMessagePort() {
  return {
    toErrorMessage: jest.fn((error: unknown) => (error instanceof Error ? error.message : String(error)))
  };
}

function createOperatingSystemProcessControlPortMock(): jest.Mocked<OperatingSystemProcessControlPort> {
  return {
    spawn: jest.fn(),
    spawnSync: jest.fn(),
    canAccessPath: jest.fn(),
    isPidAlive: jest.fn(),
    killPid: jest.fn()
  };
}

function withProcessPlatformAndArch(
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
  run: () => void
): void {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  const archDescriptor = Object.getOwnPropertyDescriptor(process, 'arch');
  Object.defineProperty(process, 'platform', { value: platform });
  Object.defineProperty(process, 'arch', { value: arch });
  try {
    run();
  } finally {
    if (platformDescriptor) {
      Object.defineProperty(process, 'platform', platformDescriptor);
    }
    if (archDescriptor) {
      Object.defineProperty(process, 'arch', archDescriptor);
    }
  }
}

describe('ChromiumUserAgentTlsService', () => {
  let operatingSystemProcessControlPort: jest.Mocked<OperatingSystemProcessControlPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    operatingSystemProcessControlPort = createOperatingSystemProcessControlPortMock();
  });

  it('whenBrowserBinaryIsResolved_resolveBrowserBinary_shouldReturnConfiguredBinary', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    // Action
    const binary = service.resolveBrowserBinary(logger);
    // Assert
    expect(binary).toBe('/usr/bin/google-chrome');
    expect(logger.log).not.toHaveBeenCalled();
    expect(operatingSystemProcessControlPort.canAccessPath).not.toHaveBeenCalled();
  });

  it('whenBrowserBinaryWasAlreadyResolved_resolveBrowserBinary_shouldReuseCachedValue', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    // Action
    const first = service.resolveBrowserBinary(logger);
    const second = service.resolveBrowserBinary(logger);
    // Assert
    expect(first).toBe('/usr/bin/google-chrome');
    expect(second).toBe('/usr/bin/google-chrome');
    expect(operatingSystemProcessControlPort.canAccessPath).not.toHaveBeenCalled();
  });

  it('whenLinuxArm64HasAbsoluteChromium_resolveBrowserBinary_shouldUseDetectedAbsoluteCandidate', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/custom/chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    operatingSystemProcessControlPort.canAccessPath.mockReturnValue(true);
    // Action
    let result = '';
    withProcessPlatformAndArch('linux', 'arm64', () => {
      result = service.resolveBrowserBinary(logger);
    });
    // Assert
    expect(result).toBe('/usr/bin/chromium');
    expect(logger.log).toHaveBeenCalledWith('Detected linux/arm64. Using Chromium binary at "/usr/bin/chromium".');
  });

  it('whenLinuxArm64FindsPathChromium_resolveBrowserBinary_shouldUsePathCandidate', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/custom/chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    operatingSystemProcessControlPort.canAccessPath.mockReturnValue(false);
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });
    // Action
    let result = '';
    withProcessPlatformAndArch('linux', 'arm64', () => {
      result = service.resolveBrowserBinary(logger);
    });
    // Assert
    expect(result).toBe('chromium');
    expect(logger.log).toHaveBeenCalledWith('Detected linux/arm64. Using Chromium binary "chromium" from PATH.');
  });

  it('whenLinuxArm64HasNoCandidate_resolveBrowserBinary_shouldFallbackToConfiguredBinary', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/custom/chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    operatingSystemProcessControlPort.canAccessPath.mockReturnValue(false);
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockReturnValue({ status: 1, stdout: '', stderr: '' });
    // Action
    let result = '';
    withProcessPlatformAndArch('linux', 'arm64', () => {
      result = service.resolveBrowserBinary(logger);
    });
    // Assert
    expect(result).toBe('/custom/chrome');
    expect(logger.warn).toHaveBeenCalledWith(
      'Detected linux/arm64 but no Chromium binary was found. Falling back to configured binary "/custom/chrome".'
    );
  });

  it('whenVersionCommandReturnsOutput_getBrowserVersion_shouldParseAndCacheVersion', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockReturnValue({
      status: 0,
      stdout: 'Google Chrome 145.0.7420.0',
      stderr: ''
    });
    // Action
    const first = service.getBrowserVersion('/usr/bin/google-chrome');
    const second = service.getBrowserVersion('/usr/bin/google-chrome');
    // Assert
    expect(first).toBe('145.0.7420.0');
    expect(second).toBe('145.0.7420.0');
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('whenBrowserBinaryIsNotProvided_getBrowserVersion_shouldResolveBinaryBeforeReadingVersion', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const resolveSpy = jest.spyOn(
      service as unknown as { resolveBrowserBinary: () => string },
      'resolveBrowserBinary'
    ).mockReturnValue('/resolved/chromium');
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockReturnValue({ status: 0, stdout: 'Chromium 145.0.7420.0', stderr: '' });
    // Action
    const version = service.getBrowserVersion();
    // Assert
    expect(version).toBe('145.0.7420.0');
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it('whenVersionCommandReturnsEmptyOutput_getBrowserVersion_shouldReturnUndefined', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockReturnValue({
      status: 0,
      stdout: '',
      stderr: ''
    });
    // Action
    const version = service.getBrowserVersion('/usr/bin/google-chrome');
    // Assert
    expect(version).toBeUndefined();
  });

  it('whenVersionCommandReturnsUndefinedStreams_getBrowserVersion_shouldFallbackToEmptyOutput', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockReturnValue({
      status: 0,
      stdout: undefined as unknown as string,
      stderr: undefined as unknown as string
    });
    // Action
    const version = service.getBrowserVersion('/usr/bin/google-chrome');
    // Assert
    expect(version).toBeUndefined();
  });

  it('whenVersionOutputHasNoSemver_getBrowserVersion_shouldReturnUndefinedFromNoMatchBranch', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockReturnValue({
      status: 0,
      stdout: 'Google Chrome development build',
      stderr: ''
    });
    // Action
    const version = service.getBrowserVersion('/usr/bin/google-chrome');
    // Assert
    expect(version).toBeUndefined();
  });

  it('whenVersionCommandFails_getBrowserVersion_shouldReturnUndefinedAndWarn', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });
    // Action
    const version = service.getBrowserVersion('/usr/bin/google-chrome', logger);
    // Assert
    expect(version).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('whenVersionCommandFailsWithoutInjectedLogger_getBrowserVersion_shouldUseInternalLoggerFallback', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const internalLogger = {
      log: jest.fn<(message: string) => void>(),
      warn: jest.fn<(message: string) => void>()
    };
    (service as unknown as { logger: typeof internalLogger }).logger = internalLogger;
    const spawnMock = operatingSystemProcessControlPort.spawnSync;
    spawnMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });
    // Action
    const version = service.getBrowserVersion('/usr/bin/google-chrome');
    // Assert
    expect(version).toBeUndefined();
    expect(internalLogger.warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      requestedUserAgent: '',
      browserVersion: undefined,
      expected: undefined,
      expectedWarnCalls: 0
    },
    {
      requestedUserAgent: 'Mozilla/5.0 custom',
      browserVersion: undefined,
      expected: 'Mozilla/5.0 custom',
      expectedWarnCalls: 1
    },
    {
      requestedUserAgent: '',
      browserVersion: '145.0.7420.0',
      expected: 'Chrome/145.0.7420.0',
      expectedWarnCalls: 0
    },
    {
      requestedUserAgent: 'Mozilla/5.0 Safari/537.36',
      browserVersion: '145.0.7420.0',
      expected: 'Chrome/145.0.7420.0',
      expectedWarnCalls: 1
    },
    {
      requestedUserAgent: 'Mozilla/5.0 Chrome/145.0.7420.0 Safari/537.36',
      browserVersion: '145.0.7420.0',
      expected: 'Chrome/145.0.7420.0',
      expectedWarnCalls: 0
    },
    {
      requestedUserAgent: 'Mozilla/5.0 Chrome/144.0.0.0 Safari/537.36',
      browserVersion: '145.0.7420.0',
      expected: 'Chrome/145.0.7420.0',
      expectedWarnCalls: 3
    }
  ])('whenLaunchUserAgentIsResolved_resolveUserAgentForLaunch_shouldNormalizeAccordingToBrowserVersion', ({
    requestedUserAgent,
    browserVersion,
    expected,
    expectedWarnCalls
  }) => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    // Action
    const resolvedUserAgent = service.resolveUserAgentForLaunch(requestedUserAgent, browserVersion, logger);
    // Assert
    if (!expected) {
      expect(resolvedUserAgent).toBeUndefined();
    } else {
      expect(resolvedUserAgent).toContain(expected);
    }
    expect(logger.warn).toHaveBeenCalledTimes(expectedWarnCalls);
  });

  it.each([
    {
      requestedUserAgent: 'Mozilla/5.0 Chrome/144.0.0.0 Safari/537.36',
      browserVersion: '145.0.7420.0',
      expected: 'Chrome/145.0.7420.0'
    },
    {
      requestedUserAgent: 'Mozilla/5.0 Safari/537.36',
      browserVersion: '145.0.7420.0',
      expected: 'Mozilla/5.0 Safari/537.36'
    },
    {
      requestedUserAgent: '',
      browserVersion: '145.0.7420.0',
      expected: undefined
    }
  ])('whenHeaderUserAgentIsResolved_resolveUserAgentForHeaders_shouldReturnExpectedValue', ({
    requestedUserAgent,
    browserVersion,
    expected
  }) => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    // Action
    const resolvedUserAgent = service.resolveUserAgentForHeaders(requestedUserAgent, browserVersion);
    // Assert
    if (!expected) {
      expect(resolvedUserAgent).toBeUndefined();
    } else {
      expect(resolvedUserAgent).toContain(expected);
    }
  });

  it('whenBrowserVersionIsUndefined_resolveUserAgentForHeaders_shouldReturnTrimmedConfiguredValue', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    // Action
    const result = service.resolveUserAgentForHeaders('  Mozilla/5.0 Chrome/145.0.0.0 Safari/537.36  ', undefined);
    // Assert
    expect(result).toBe('Mozilla/5.0 Chrome/145.0.0.0 Safari/537.36');
  });

  it('whenHeaderUserAgentInputIsUndefined_resolveUserAgentForHeaders_shouldReturnUndefined', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    // Action
    const result = service.resolveUserAgentForHeaders(undefined as unknown as string, '145.0.7420.0');
    // Assert
    expect(result).toBeUndefined();
  });

  it('whenDefaultUserAgentIsBuiltOnWindows_resolveUserAgentForLaunch_shouldUseWindowsToken', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    // Action
    let result = '';
    withProcessPlatformAndArch('win32', 'x64', () => {
      result = service.resolveUserAgentForLaunch('', '145.0.7420.0', logger) ?? '';
    });
    // Assert
    expect(result).toContain('Windows NT 10.0; Win64; x64');
  });

  it('whenDefaultUserAgentIsBuiltOnLinuxX64_resolveUserAgentForLaunch_shouldUseLinuxX64Token', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    // Action
    let result = '';
    withProcessPlatformAndArch('linux', 'x64', () => {
      result = service.resolveUserAgentForLaunch('', '145.0.7420.0', logger) ?? '';
    });
    // Assert
    expect(result).toContain('X11; Linux x86_64');
  });

  it('whenDefaultUserAgentIsBuiltOnLinuxArm64_resolveUserAgentForLaunch_shouldUseLinuxArm64Token', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig, createErrorMessagePort() as never, operatingSystemProcessControlPort);
    const logger = new LoggerLikeMock();
    // Action
    let result = '';
    withProcessPlatformAndArch('linux', 'arm64', () => {
      result = service.resolveUserAgentForLaunch('', '145.0.7420.0', logger) ?? '';
    });
    // Assert
    expect(result).toContain('X11; Linux aarch64');
  });
});
