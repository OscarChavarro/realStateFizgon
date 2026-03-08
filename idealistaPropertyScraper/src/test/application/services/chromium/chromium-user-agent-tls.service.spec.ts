import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { ChromiumUserAgentTlsService } from 'src/application/services/chromium/chromium-user-agent-tls.service';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { LoggerLikeMock } from '../../../support/mocks/logger-like.mock';

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn()
}));

jest.mock('node:fs', () => ({
  accessSync: jest.fn()
}));

class ChromeConfigMockForUserAgent {
  constructor(public readonly chromeBinary: string) {}
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenBrowserBinaryIsResolved_resolveBrowserBinary_shouldReturnConfiguredBinary', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const logger = new LoggerLikeMock();
    // Action
    const binary = service.resolveBrowserBinary(logger);
    // Assert
    expect(binary).toBe('/usr/bin/google-chrome');
    expect(logger.log).not.toHaveBeenCalled();
    expect(accessSync).not.toHaveBeenCalled();
  });

  it('whenBrowserBinaryWasAlreadyResolved_resolveBrowserBinary_shouldReuseCachedValue', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const logger = new LoggerLikeMock();
    // Action
    const first = service.resolveBrowserBinary(logger);
    const second = service.resolveBrowserBinary(logger);
    // Assert
    expect(first).toBe('/usr/bin/google-chrome');
    expect(second).toBe('/usr/bin/google-chrome');
    expect(accessSync).not.toHaveBeenCalled();
  });

  it('whenLinuxArm64HasAbsoluteChromium_resolveBrowserBinary_shouldUseDetectedAbsoluteCandidate', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/custom/chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const logger = new LoggerLikeMock();
    const accessMock = accessSync as unknown as jest.Mock;
    accessMock.mockImplementation(() => undefined);
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const logger = new LoggerLikeMock();
    const accessMock = accessSync as unknown as jest.Mock;
    accessMock.mockImplementation(() => {
      throw new Error('missing');
    });
    const spawnMock = spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValueOnce({ status: 0 });
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const logger = new LoggerLikeMock();
    const accessMock = accessSync as unknown as jest.Mock;
    accessMock.mockImplementation(() => {
      throw new Error('missing');
    });
    const spawnMock = spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValue({ status: 1 });
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const spawnMock = spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValue({
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const resolveSpy = jest.spyOn(
      service as unknown as { resolveBrowserBinary: () => string },
      'resolveBrowserBinary'
    ).mockReturnValue('/resolved/chromium');
    const spawnMock = spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValue({ stdout: 'Chromium 145.0.7420.0', stderr: '' });
    // Action
    const version = service.getBrowserVersion();
    // Assert
    expect(version).toBe('145.0.7420.0');
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it('whenVersionCommandReturnsEmptyOutput_getBrowserVersion_shouldReturnUndefined', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const spawnMock = spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValue({
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const spawnMock = spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValue({
      stdout: undefined,
      stderr: undefined
    });
    // Action
    const version = service.getBrowserVersion('/usr/bin/google-chrome');
    // Assert
    expect(version).toBeUndefined();
  });

  it('whenVersionOutputHasNoSemver_getBrowserVersion_shouldReturnUndefinedFromNoMatchBranch', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const spawnMock = spawnSync as unknown as jest.Mock;
    spawnMock.mockReturnValue({
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const logger = new LoggerLikeMock();
    const spawnMock = spawnSync as unknown as jest.Mock;
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    const internalLogger = {
      log: jest.fn<(message: string) => void>(),
      warn: jest.fn<(message: string) => void>()
    };
    (service as unknown as { logger: typeof internalLogger }).logger = internalLogger;
    const spawnMock = spawnSync as unknown as jest.Mock;
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    // Action
    const result = service.resolveUserAgentForHeaders('  Mozilla/5.0 Chrome/145.0.0.0 Safari/537.36  ', undefined);
    // Assert
    expect(result).toBe('Mozilla/5.0 Chrome/145.0.0.0 Safari/537.36');
  });

  it('whenHeaderUserAgentInputIsUndefined_resolveUserAgentForHeaders_shouldReturnUndefined', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
    // Action
    const result = service.resolveUserAgentForHeaders(undefined as unknown as string, '145.0.7420.0');
    // Assert
    expect(result).toBeUndefined();
  });

  it('whenDefaultUserAgentIsBuiltOnWindows_resolveUserAgentForLaunch_shouldUseWindowsToken', () => {
    // Arrange
    const config = new ChromeConfigMockForUserAgent('/usr/bin/google-chrome');
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
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
    const service = new ChromiumUserAgentTlsService(config as unknown as ChromeConfig);
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
