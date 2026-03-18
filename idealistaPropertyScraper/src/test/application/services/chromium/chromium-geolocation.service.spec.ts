import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ChromiumPermissionRegistrarService } from 'src/application/services/chromium/chromium-permission-registrar.service';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';

jest.mock('chrome-remote-interface', () => {
  const cdp = jest.fn();
  return Object.assign(cdp, {
    Version: jest.fn(),
    List: jest.fn()
  });
});

type CdpCallMock = jest.MockedFunction<(params?: unknown) => Promise<unknown>>;
type CdpVersionMock = jest.MockedFunction<
  (params: { host: string; port: number }) => Promise<{ webSocketDebuggerUrl?: string }>
>;
type CdpListMock = jest.MockedFunction<
  (params: { host: string; port: number }) => Promise<Array<{ type?: string; id?: string; targetId?: string; url?: string }>>
>;

class ChromeConfigMockForGeolocation {
  constructor(
    public geolocationAllowlist: string[] = [],
    public geolocationOverride: { latitude: number; longitude: number; accuracy: number } | undefined = undefined,
    public chromeCdpPollIntervalMs = 500
  ) {}
}

class ChromiumPageSyncServiceMockForGeolocation {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class ChromiumPermissionRegistrarServiceMockForGeolocation {
  readonly registerPageNavigationListener = jest.fn<(client: unknown, page: unknown, allowlist?: string[]) => void>();
  readonly ensureOriginIsAuthorized = jest.fn<(client: unknown, urlOrOrigin: string, allowlist?: string[]) => Promise<void>>();
  readonly grantGeolocationPermissions = jest.fn<(client: unknown, allowlist: string[]) => Promise<void>>();
}

function createService(config?: ChromeConfigMockForGeolocation) {
  const chromeConfig = config ?? new ChromeConfigMockForGeolocation();
  const pageSync = new ChromiumPageSyncServiceMockForGeolocation();
  pageSync.sleep.mockResolvedValue(undefined);
  const permissionRegistrar = new ChromiumPermissionRegistrarServiceMockForGeolocation();
  permissionRegistrar.ensureOriginIsAuthorized.mockResolvedValue(undefined);
  permissionRegistrar.grantGeolocationPermissions.mockResolvedValue(undefined);
  const service = new ChromiumGeolocationService(
    chromeConfig as unknown as ChromeConfig,
    pageSync as unknown as ChromiumPageSyncService,
    permissionRegistrar as unknown as ChromiumPermissionRegistrarService
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: typeof logger }).logger = logger;
  return { service, chromeConfig, pageSync, permissionRegistrar, logger };
}

describe('ChromiumGeolocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenPageNavigationListenerIsRegistered_registerPageNavigationListener_shouldDelegateWithAllowlist', () => {
    // Arrange
    const { service, permissionRegistrar } = createService(new ChromeConfigMockForGeolocation(['https://www.idealista.com']));
    // Action
    service.registerPageNavigationListener({ Browser: {} }, { frameNavigated: jest.fn() });
    // Assert
    expect(permissionRegistrar.registerPageNavigationListener).toHaveBeenCalledWith(
      { Browser: {} },
      { frameNavigated: expect.any(Function) },
      ['https://www.idealista.com']
    );
  });

  it('whenOriginMustBeAuthorized_ensureOriginIsAuthorized_shouldDelegateUsingConfiguredAllowlist', async () => {
    // Arrange
    const { service, permissionRegistrar } = createService(new ChromeConfigMockForGeolocation(['https://www.idealista.com']));
    // Action
    await service.ensureOriginIsAuthorized({}, 'https://www.idealista.com/inmueble/1/');
    // Assert
    expect(permissionRegistrar.ensureOriginIsAuthorized).toHaveBeenCalledWith(
      {},
      'https://www.idealista.com/inmueble/1/',
      ['https://www.idealista.com']
    );
  });

  it('whenOverrideIsMissingOrApiUnavailable_applyGeolocationOverride_shouldSkipWithoutCallingEmulation', async () => {
    // Arrange
    const { service } = createService(new ChromeConfigMockForGeolocation([], undefined));
    const setGeolocationOverride = jest.fn<(
      params: { latitude: number; longitude: number; accuracy: number }
    ) => Promise<void>>(async () => undefined);
    // Action
    await service.applyGeolocationOverride({});
    await service.applyGeolocationOverride({ Emulation: {} });
    // Assert
    expect(setGeolocationOverride).not.toHaveBeenCalled();
  });

  it('whenOverrideApplicationFails_applyGeolocationOverride_shouldWarnAndContinue', async () => {
    // Arrange
    const { service, logger } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 })
    );
    // Action
    await service.applyGeolocationOverride({
      Emulation: {
        setGeolocationOverride: async () => {
          throw new Error('override failed');
        }
      }
    });
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Failed to set geolocation override. override failed');
  });

  it('whenOverrideIsValid_applyGeolocationOverride_shouldCallEmulationWithConfiguredCoordinates', async () => {
    // Arrange
    const { service, chromeConfig } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 })
    );
    const setGeolocationOverride = jest.fn<(
      params: { latitude: number; longitude: number; accuracy: number }
    ) => Promise<void>>(async () => undefined);
    // Action
    await service.applyGeolocationOverride({ Emulation: { setGeolocationOverride } });
    // Assert
    expect(setGeolocationOverride).toHaveBeenCalledWith({
      latitude: 40.4,
      longitude: -3.7,
      accuracy: 50
    });
  });

  it('whenStartupAllowlistIsEmpty_grantStartupPermissions_shouldSkipCdpCalls', async () => {
    // Arrange
    const { service } = createService(new ChromeConfigMockForGeolocation([]));
    // Action
    await service.grantStartupPermissions('127.0.0.1', 9222);
    // Assert
    expect((CDP as unknown as jest.Mock).mock.calls.length).toBe(0);
    expect((CDP.Version as unknown as jest.Mock).mock.calls.length).toBe(0);
  });

  it('whenVersionEndpointHasNoBrowserSocket_grantStartupPermissions_shouldWarnAndReturn', async () => {
    // Arrange
    const { service, logger } = createService(new ChromeConfigMockForGeolocation(['https://www.idealista.com']));
    const versionMock = CDP.Version as unknown as CdpVersionMock;
    versionMock.mockResolvedValue({});
    // Action
    await service.grantStartupPermissions('127.0.0.1', 9222);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      'CDP version info did not include a browser WebSocket URL. Skipping geolocation pre-grant.'
    );
  });

  it('whenStartupPermissionGrantSucceeds_grantStartupPermissions_shouldGrantAndCloseClient', async () => {
    // Arrange
    const { service, permissionRegistrar } = createService(new ChromeConfigMockForGeolocation(['https://www.idealista.com']));
    const close = jest.fn(async () => undefined);
    const cdpCallMock = CDP as unknown as CdpCallMock;
    const versionMock = CDP.Version as unknown as CdpVersionMock;
    versionMock.mockResolvedValue({ webSocketDebuggerUrl: 'ws://chrome-browser' });
    cdpCallMock.mockResolvedValue({ close });
    // Action
    await service.grantStartupPermissions('127.0.0.1', 9222);
    // Assert
    expect(permissionRegistrar.grantGeolocationPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ close }),
      ['https://www.idealista.com']
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('whenStartupPermissionGrantFails_grantStartupPermissions_shouldWarnAndCloseClient', async () => {
    // Arrange
    const { service, permissionRegistrar, logger } = createService(new ChromeConfigMockForGeolocation(['https://www.idealista.com']));
    const close = jest.fn(async () => undefined);
    const cdpCallMock = CDP as unknown as CdpCallMock;
    const versionMock = CDP.Version as unknown as CdpVersionMock;
    versionMock.mockResolvedValue({ webSocketDebuggerUrl: 'ws://chrome-browser' });
    cdpCallMock.mockResolvedValue({ close });
    permissionRegistrar.grantGeolocationPermissions.mockRejectedValueOnce(new Error('grant failed'));
    // Action
    await service.grantStartupPermissions('127.0.0.1', 9222);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Failed to pre-grant geolocation permissions. grant failed');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('whenLoopIsAlreadyRunning_startTargetLoop_shouldIgnoreNewStartRequest', () => {
    // Arrange
    const { service } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 })
    );
    (service as unknown as { geolocationTargetLoopRunning: boolean }).geolocationTargetLoopRunning = true;
    const runLoopSpy = jest.spyOn(
      service as unknown as {
        runGeolocationTargetLoop: (host: string, port: number, isShuttingDown: () => boolean) => Promise<void>;
      },
      'runGeolocationTargetLoop'
    );
    // Action
    service.startTargetLoop('127.0.0.1', 9222, () => false);
    // Assert
    expect(runLoopSpy).not.toHaveBeenCalled();
  });

  it('whenOverrideIsMissing_startTargetLoop_shouldSkipLoop', () => {
    // Arrange
    const { service } = createService(new ChromeConfigMockForGeolocation([], undefined));
    const runLoopSpy = jest.spyOn(
      service as unknown as {
        runGeolocationTargetLoop: (host: string, port: number, isShuttingDown: () => boolean) => Promise<void>;
      },
      'runGeolocationTargetLoop'
    );
    // Action
    service.startTargetLoop('127.0.0.1', 9222, () => false);
    // Assert
    expect(runLoopSpy).not.toHaveBeenCalled();
  });

  it('whenRunLoopFails_startTargetLoop_shouldWarnAndResetRunningFlag', async () => {
    // Arrange
    const { service, logger } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 })
    );
    jest.spyOn(
      service as unknown as {
        runGeolocationTargetLoop: (host: string, port: number, isShuttingDown: () => boolean) => Promise<void>;
      },
      'runGeolocationTargetLoop'
    ).mockRejectedValue(new Error('loop failed'));
    // Action
    service.startTargetLoop('127.0.0.1', 9222, () => false);
    await Promise.resolve();
    await Promise.resolve();
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Geolocation target loop failed. loop failed');
    expect((service as unknown as { geolocationTargetLoopRunning: boolean }).geolocationTargetLoopRunning).toBe(false);
  });

  it('whenRunLoopExecutes_runGeolocationTargetLoop_shouldPollTargetsAndSleepWithMinimumInterval', async () => {
    // Arrange
    const { service, pageSync } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 }, 500)
    );
    const refreshSpy = jest.spyOn(
      service as unknown as { applyGeolocationOverrideToOpenTargets: (host: string, port: number) => Promise<void> },
      'applyGeolocationOverrideToOpenTargets'
    ).mockResolvedValue(undefined);
    let calls = 0;
    // Action
    await (service as unknown as {
      runGeolocationTargetLoop: (host: string, port: number, isShuttingDown: () => boolean) => Promise<void>;
    }).runGeolocationTargetLoop('127.0.0.1', 9222, () => {
      calls += 1;
      return calls > 1;
    });
    // Assert
    expect(refreshSpy).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(pageSync.sleep).toHaveBeenCalledWith(2000);
  });

  it('whenTargetRefreshFails_runGeolocationTargetLoop_shouldWarnAndContinueSleeping', async () => {
    // Arrange
    const { service, pageSync, logger } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 }, 2500)
    );
    const refreshSpy = jest.spyOn(
      service as unknown as { applyGeolocationOverrideToOpenTargets: (host: string, port: number) => Promise<void> },
      'applyGeolocationOverrideToOpenTargets'
    ).mockRejectedValue(new Error('refresh failed'));
    let calls = 0;
    // Action
    await (service as unknown as {
      runGeolocationTargetLoop: (host: string, port: number, isShuttingDown: () => boolean) => Promise<void>;
    }).runGeolocationTargetLoop('127.0.0.1', 9222, () => {
      calls += 1;
      return calls > 1;
    });
    // Assert
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Failed to refresh geolocation targets. refresh failed');
    expect(pageSync.sleep).toHaveBeenCalledWith(2500);
  });

  it('whenOverrideDoesNotExist_applyGeolocationOverrideToOpenTargets_shouldReturnWithoutListingTargets', async () => {
    // Arrange
    const { service } = createService(new ChromeConfigMockForGeolocation([], undefined));
    // Action
    await (service as unknown as {
      applyGeolocationOverrideToOpenTargets: (host: string, port: number) => Promise<void>;
    }).applyGeolocationOverrideToOpenTargets('127.0.0.1', 9222);
    // Assert
    expect((CDP.List as unknown as jest.Mock).mock.calls.length).toBe(0);
  });

  it('whenTargetsAreListed_applyGeolocationOverrideToOpenTargets_shouldFilterAndCleanupStaleOrigins', async () => {
    // Arrange
    const { service } = createService(
      new ChromeConfigMockForGeolocation(
        ['https://www.idealista.com'],
        { latitude: 40.4, longitude: -3.7, accuracy: 50 }
      )
    );
    const applyToTargetSpy = jest.spyOn(
      service as unknown as {
        applyGeolocationOverrideToTarget: (
          target: { id?: string; targetId?: string; url?: string; type?: string },
          targetKey: string,
          origin: string,
          host: string,
          port: number
        ) => Promise<void>;
      },
      'applyGeolocationOverrideToTarget'
    ).mockResolvedValue(undefined);
    const map = (service as unknown as { geolocationTargetOrigins: Map<string, string> }).geolocationTargetOrigins;
    map.set('cached-same-origin', 'https://www.idealista.com');
    map.set('stale-key', 'https://www.idealista.com');
    const listMock = CDP.List as unknown as CdpListMock;
    listMock.mockResolvedValue([
      { type: 'service_worker', id: 'worker-1', url: 'https://www.idealista.com' },
      { type: 'page', id: 'cached-same-origin', url: 'https://www.idealista.com/inmueble/1/' },
      { type: 'page', id: 'blocked-origin', url: 'https://www.example.com/page' },
      { type: 'page', id: 'invalid-url', url: 'javascript:void(0)' },
      { type: 'page', id: 'allowed-new', url: 'https://www.idealista.com/inmueble/2/' }
    ]);
    // Action
    await (service as unknown as {
      applyGeolocationOverrideToOpenTargets: (host: string, port: number) => Promise<void>;
    }).applyGeolocationOverrideToOpenTargets('127.0.0.1', 9222);
    // Assert
    expect(applyToTargetSpy).toHaveBeenCalledTimes(1);
    expect(applyToTargetSpy).toHaveBeenCalledWith(
      { type: 'page', id: 'allowed-new', url: 'https://www.idealista.com/inmueble/2/' },
      'allowed-new',
      'https://www.idealista.com',
      '127.0.0.1',
      9222
    );
    expect(map.has('stale-key')).toBe(false);
    expect(map.has('cached-same-origin')).toBe(true);
  });

  it('whenPageTargetsHaveNoResolvableKeyOrOrigin_applyGeolocationOverrideToOpenTargets_shouldSkipThem', async () => {
    // Arrange
    const { service } = createService(
      new ChromeConfigMockForGeolocation(
        ['https://www.idealista.com'],
        { latitude: 40.4, longitude: -3.7, accuracy: 50 }
      )
    );
    const applyToTargetSpy = jest.spyOn(
      service as unknown as {
        applyGeolocationOverrideToTarget: (
          target: { id?: string; targetId?: string; url?: string; type?: string },
          targetKey: string,
          origin: string,
          host: string,
          port: number
        ) => Promise<void>;
      },
      'applyGeolocationOverrideToTarget'
    ).mockResolvedValue(undefined);
    const listMock = CDP.List as unknown as CdpListMock;
    listMock.mockResolvedValue([
      { type: 'page' },
      { type: 'page', targetId: 'target-without-url' }
    ]);
    // Action
    await (service as unknown as {
      applyGeolocationOverrideToOpenTargets: (host: string, port: number) => Promise<void>;
    }).applyGeolocationOverrideToOpenTargets('127.0.0.1', 9222);
    // Assert
    expect(applyToTargetSpy).not.toHaveBeenCalled();
  });

  it('whenApplyingOverrideToTargetSucceeds_applyGeolocationOverrideToTarget_shouldPersistOriginAndCloseClient', async () => {
    // Arrange
    const { service } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 })
    );
    const close = jest.fn(async () => undefined);
    const cdpCallMock = CDP as unknown as CdpCallMock;
    cdpCallMock.mockResolvedValue({ close, Emulation: {} });
    const applyOverrideSpy = jest.spyOn(
      service as unknown as { applyGeolocationOverride: (client: unknown) => Promise<void> },
      'applyGeolocationOverride'
    ).mockResolvedValue(undefined);
    // Action
    await (service as unknown as {
      applyGeolocationOverrideToTarget: (
        target: { id?: string; targetId?: string; url?: string; type?: string },
        targetKey: string,
        origin: string,
        host: string,
        port: number
      ) => Promise<void>;
    }).applyGeolocationOverrideToTarget({ id: 'target-1', type: 'page' }, 'target-1', 'https://www.idealista.com', '127.0.0.1', 9222);
    // Assert
    expect(applyOverrideSpy).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(
      (service as unknown as { geolocationTargetOrigins: Map<string, string> }).geolocationTargetOrigins.get('target-1')
    ).toBe('https://www.idealista.com');
  });

  it('whenApplyingOverrideToTargetFails_applyGeolocationOverrideToTarget_shouldWarn', async () => {
    // Arrange
    const { service, logger } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 })
    );
    const close = jest.fn(async () => undefined);
    const cdpCallMock = CDP as unknown as CdpCallMock;
    cdpCallMock.mockResolvedValue({ close });
    jest.spyOn(
      service as unknown as { applyGeolocationOverride: (client: unknown) => Promise<void> },
      'applyGeolocationOverride'
    ).mockRejectedValue(new Error('apply failed'));
    // Action
    await (service as unknown as {
      applyGeolocationOverrideToTarget: (
        target: { id?: string; targetId?: string; url?: string; type?: string },
        targetKey: string,
        origin: string,
        host: string,
        port: number
      ) => Promise<void>;
    }).applyGeolocationOverrideToTarget({ id: 'target-2', type: 'page' }, 'target-2', 'https://www.idealista.com', '127.0.0.1', 9222);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Failed to apply geolocation override for target-2. apply failed');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('whenCdpClientCreationFails_applyGeolocationOverrideToTarget_shouldWarnWithoutClosingClient', async () => {
    // Arrange
    const { service, logger } = createService(
      new ChromeConfigMockForGeolocation([], { latitude: 40.4, longitude: -3.7, accuracy: 50 })
    );
    const cdpCallMock = CDP as unknown as CdpCallMock;
    cdpCallMock.mockRejectedValue(new Error('cdp connect failed'));
    // Action
    await (service as unknown as {
      applyGeolocationOverrideToTarget: (
        target: { id?: string; targetId?: string; url?: string; type?: string },
        targetKey: string,
        origin: string,
        host: string,
        port: number
      ) => Promise<void>;
    }).applyGeolocationOverrideToTarget({ id: 'target-3', type: 'page' }, 'target-3', 'https://www.idealista.com', '127.0.0.1', 9222);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('Failed to apply geolocation override for target-3. cdp connect failed');
  });

  it('whenTargetKeyOrOriginAreDerived_getTargetKeyAndOriginHelpers_shouldHandleAllFallbackBranches', () => {
    // Arrange
    const { service } = createService();
    // Action
    const byId = (service as unknown as { getTargetKey: (target: { id?: string; targetId?: string; url?: string }) => string | undefined })
      .getTargetKey({ id: 'id-1' });
    const byTargetId = (service as unknown as { getTargetKey: (target: { id?: string; targetId?: string; url?: string }) => string | undefined })
      .getTargetKey({ targetId: 'target-id-1' });
    const byUrl = (service as unknown as { getTargetKey: (target: { id?: string; targetId?: string; url?: string }) => string | undefined })
      .getTargetKey({ url: ' https://www.idealista.com/x ' });
    const noKey = (service as unknown as { getTargetKey: (target: { id?: string; targetId?: string; url?: string }) => string | undefined })
      .getTargetKey({});
    const allowedEmptyAllowlist = (service as unknown as { isOriginAllowed: (origin: string, allowlist: string[]) => boolean })
      .isOriginAllowed('https://www.idealista.com', []);
    const allowedMatch = (service as unknown as { isOriginAllowed: (origin: string, allowlist: string[]) => boolean })
      .isOriginAllowed('https://www.idealista.com', ['https://www.idealista.com/path']);
    const denied = (service as unknown as { isOriginAllowed: (origin: string, allowlist: string[]) => boolean })
      .isOriginAllowed('https://www.idealista.com', ['https://www.example.com']);
    const originValid = (service as unknown as { toOrigin: (value: string) => string | undefined })
      .toOrigin('https://www.idealista.com/inmueble/1/');
    const originTrimmedEmpty = (service as unknown as { toOrigin: (value: string) => string | undefined }).toOrigin('   ');
    const originInvalidProtocol = (service as unknown as { toOrigin: (value: string) => string | undefined }).toOrigin('ftp://server');
    const originInvalid = (service as unknown as { toOrigin: (value: string) => string | undefined }).toOrigin('not-an-url');
    const originNullish = (service as unknown as { toOrigin: (value: string) => string | undefined })
      .toOrigin(undefined as unknown as string);
    // Assert
    expect(byId).toBe('id-1');
    expect(byTargetId).toBe('target-id-1');
    expect(byUrl).toBe('https://www.idealista.com/x');
    expect(noKey).toBeUndefined();
    expect(allowedEmptyAllowlist).toBe(true);
    expect(allowedMatch).toBe(true);
    expect(denied).toBe(false);
    expect(originValid).toBe('https://www.idealista.com');
    expect(originTrimmedEmpty).toBeUndefined();
    expect(originInvalidProtocol).toBeUndefined();
    expect(originInvalid).toBeUndefined();
    expect(originNullish).toBeUndefined();
  });
});
