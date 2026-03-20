import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CDP = require('chrome-remote-interface');
import { ChromiumNetworkHeadersService } from 'application/services/chromium/chromium-network-headers.service';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { CdpNetworkClient } from 'application/services/chromium/cdp-network-client.type';
import { ChromiumUserAgentTlsService } from 'application/services/chromium/chromium-user-agent-tls.service';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';

jest.mock('chrome-remote-interface', () => {
  const cdp = jest.fn();
  (cdp as unknown as { List: jest.Mock }).List = jest.fn();
  return cdp;
});

type HeaderOverrides = {
  userAgentOverride?: unknown;
  extraHeaders: Record<string, string>;
  signature: string;
};

type PageTarget = {
  id?: string;
  targetId?: string;
  url?: string;
  type?: string;
};

class ChromeConfigMockForChromiumNetworkHeadersService {
  constructor(
    public readonly chromeCdpPollIntervalMs: number,
    public readonly chromeUserAgent: string,
    public readonly chromeAcceptLanguage: string,
    public readonly chromeExtraHeaders: Record<string, string>
  ) {}
}

class ChromiumPageSyncServiceMockForChromiumNetworkHeadersService {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class ChromiumUserAgentTlsServiceMockForChromiumNetworkHeadersService {
  readonly resolveBrowserBinary = jest.fn<() => string>();
  readonly getBrowserVersion = jest.fn<(browserBinary?: string) => string | undefined>();
  readonly resolveUserAgentForHeaders = jest.fn<(requestedUserAgent: string, browserVersion?: string) => string | undefined>();
}

type LoggerMock = {
  warn: jest.Mock<(message: string) => void>;
  log: jest.Mock<(message: string) => void>;
};

function createService(config?: {
  chromeCdpPollIntervalMs?: number;
  chromeUserAgent?: string;
  chromeAcceptLanguage?: string;
  chromeExtraHeaders?: Record<string, string>;
  resolvedUserAgent?: string | undefined;
  browserVersion?: string | undefined;
}) {
  const chromeConfig = new ChromeConfigMockForChromiumNetworkHeadersService(
    config?.chromeCdpPollIntervalMs ?? 100,
    config?.chromeUserAgent ?? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145.0.7420.0 Safari/537.36',
    config?.chromeAcceptLanguage ?? 'en-US,en;q=0.9,es;q=0.8',
    config?.chromeExtraHeaders ?? { DNT: '1' }
  );
  const chromiumPageSyncService = new ChromiumPageSyncServiceMockForChromiumNetworkHeadersService();
  chromiumPageSyncService.sleep.mockResolvedValue(undefined);
  const chromiumUserAgentTlsService = new ChromiumUserAgentTlsServiceMockForChromiumNetworkHeadersService();
  chromiumUserAgentTlsService.resolveBrowserBinary.mockReturnValue('/usr/bin/chromium');
  chromiumUserAgentTlsService.getBrowserVersion.mockReturnValue(config?.browserVersion ?? '145.0.7420.0');
  chromiumUserAgentTlsService.resolveUserAgentForHeaders.mockReturnValue(
    config?.resolvedUserAgent ?? chromeConfig.chromeUserAgent
  );

  const service = new ChromiumNetworkHeadersService(
    chromeConfig as unknown as ChromeConfig,
    chromiumPageSyncService as unknown as ChromiumPageSyncService,
    chromiumUserAgentTlsService as unknown as ChromiumUserAgentTlsService
  );
  const logger: LoggerMock = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: LoggerMock }).logger = logger;

  return {
    service,
    chromeConfig,
    chromiumPageSyncService,
    chromiumUserAgentTlsService,
    logger
  };
}

async function callApplyOverridesToClient(
  service: ChromiumNetworkHeadersService,
  client: CdpNetworkClient,
  overrides: HeaderOverrides
): Promise<boolean> {
  return (service as unknown as {
    applyOverridesToClient: (targetClient: CdpNetworkClient, targetOverrides: HeaderOverrides) => Promise<boolean>;
  }).applyOverridesToClient(client, overrides);
}

function callBuildOverrides(service: ChromiumNetworkHeadersService): HeaderOverrides {
  return (service as unknown as { buildOverrides: () => HeaderOverrides }).buildOverrides();
}

function callToCdpAcceptLanguage(service: ChromiumNetworkHeadersService, value: string): string | undefined {
  return (service as unknown as { toCdpAcceptLanguage: (acceptLanguage: string) => string | undefined })
    .toCdpAcceptLanguage(value);
}

describe('ChromiumNetworkHeadersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenClientHasNoNetworkDomain_applyOverridesToClient_shouldReturnFalse', async () => {
    // Arrange
    const { service } = createService();
    const overrides = callBuildOverrides(service);
    // Action
    const applied = await callApplyOverridesToClient(service, {}, overrides);
    // Assert
    expect(applied).toBe(false);
  });

  it('whenClientSupportsNetwork_applyOverridesToClient_shouldApplyUserAgentAndHeaders', async () => {
    // Arrange
    const { service } = createService();
    const overrides = callBuildOverrides(service);
    const enable = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const setExtraHTTPHeaders = jest.fn<(params: { headers: Record<string, string> }) => Promise<void>>()
      .mockResolvedValue(undefined);
    const setUserAgentOverride = jest.fn<(params: unknown) => Promise<void>>().mockResolvedValue(undefined);
    const client = {
      Network: {
        enable,
        setExtraHTTPHeaders
      },
      Emulation: {
        setUserAgentOverride
      }
    } as unknown as CdpNetworkClient;
    // Action
    const applied = await callApplyOverridesToClient(service, client, overrides);
    // Assert
    expect(applied).toBe(true);
    expect(enable).toHaveBeenCalledTimes(1);
    expect(setUserAgentOverride).toHaveBeenCalledWith(overrides.userAgentOverride);
    expect(setExtraHTTPHeaders).toHaveBeenCalledWith({ headers: overrides.extraHeaders });
  });

  it('whenApplyHeadersIsCalled_applyHeaders_shouldUseBuildOverridesAndApplyToClient', async () => {
    // Arrange
    const { service } = createService();
    const client = {
      Network: {
        enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        setExtraHTTPHeaders: jest.fn<(params: { headers: Record<string, string> }) => Promise<void>>().mockResolvedValue(undefined)
      }
    } as unknown as CdpNetworkClient;
    const buildOverridesSpy = jest.spyOn(
      service as unknown as { buildOverrides: () => HeaderOverrides },
      'buildOverrides'
    );
    const applyOverridesSpy = jest.spyOn(
      service as unknown as {
        applyOverridesToClient: (targetClient: CdpNetworkClient, targetOverrides: HeaderOverrides) => Promise<boolean>;
      },
      'applyOverridesToClient'
    );
    // Action
    await service.applyHeaders(client);
    // Assert
    expect(buildOverridesSpy).toHaveBeenCalledTimes(1);
    expect(applyOverridesSpy).toHaveBeenCalledWith(client, expect.objectContaining({ signature: expect.any(String) }));
  });

  it('whenStartTargetLoopIsAlreadyRunning_startTargetLoop_shouldIgnoreSecondStart', async () => {
    // Arrange
    const { service } = createService();
    const runLoopSpy = jest.spyOn(
      service as unknown as {
        runHeadersTargetLoop: (cdpHost: string, cdpPort: number, isShuttingDown: () => boolean) => Promise<void>;
      },
      'runHeadersTargetLoop'
    ).mockImplementation(async () => {
      await Promise.resolve();
    });
    // Action
    service.startTargetLoop('127.0.0.1', 9222, () => false);
    service.startTargetLoop('127.0.0.1', 9222, () => false);
    await Promise.resolve();
    // Assert
    expect(runLoopSpy).toHaveBeenCalledTimes(1);
  });

  it('whenStartTargetLoopFails_startTargetLoop_shouldLogWarningAndResetFlag', async () => {
    // Arrange
    const { service, logger } = createService();
    jest.spyOn(
      service as unknown as {
        runHeadersTargetLoop: (cdpHost: string, cdpPort: number, isShuttingDown: () => boolean) => Promise<void>;
      },
      'runHeadersTargetLoop'
    ).mockRejectedValue(new Error('loop failure'));
    // Action
    service.startTargetLoop('127.0.0.1', 9222, () => false);
    await Promise.resolve();
    await Promise.resolve();
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Network headers target loop failed.'));
    expect((service as unknown as { headersTargetLoopRunning: boolean }).headersTargetLoopRunning).toBe(false);
  });

  it('whenRunTargetLoopRefreshFails_runHeadersTargetLoop_shouldLogWarningAndSleepWithMinimumInterval', async () => {
    // Arrange
    const { service, chromiumPageSyncService, logger } = createService({ chromeCdpPollIntervalMs: 100 });
    const applySpy = jest.spyOn(
      service as unknown as {
        applyOverridesToOpenTargets: (cdpHost: string, cdpPort: number) => Promise<void>;
      },
      'applyOverridesToOpenTargets'
    ).mockRejectedValue(new Error('refresh failed'));
    let stop = false;
    chromiumPageSyncService.sleep.mockImplementation(async () => {
      stop = true;
    });
    // Action
    await (service as unknown as {
      runHeadersTargetLoop: (cdpHost: string, cdpPort: number, isShuttingDown: () => boolean) => Promise<void>;
    }).runHeadersTargetLoop('127.0.0.1', 9222, () => stop);
    // Assert
    expect(applySpy).toHaveBeenCalledWith('127.0.0.1', 9222);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to refresh network header targets.'));
    expect(chromiumPageSyncService.sleep).toHaveBeenCalledWith(250);
  });

  it('whenApplyingOverridesToOpenTargets_applyOverridesToOpenTargets_shouldApplyAndCleanupStaleTargets', async () => {
    // Arrange
    const { service } = createService();
    const cdpMock = CDP as unknown as jest.Mock & { List: jest.Mock };
    const cdpListMock = cdpMock.List as unknown as jest.MockedFunction<
      (params: { host: string; port: number }) => Promise<PageTarget[]>
    >;
    cdpListMock.mockResolvedValue([
      { id: 'page-1', type: 'page', url: 'https://one' },
      { id: 'worker-1', type: 'service_worker', url: 'https://worker' },
      { type: 'page', url: '   ' }
    ] as PageTarget[]);
    const ensureSpy = jest.spyOn(
      service as unknown as {
        ensureTargetOverrides: (
          target: PageTarget,
          targetKey: string,
          overrides: HeaderOverrides,
          cdpHost: string,
          cdpPort: number
        ) => Promise<void>;
      },
      'ensureTargetOverrides'
    ).mockResolvedValue(undefined);
    const staleClose = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const staleCloseWithError = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('close error'));
    (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients.set('stale-1', {
      client: { close: staleClose },
      signature: 'old'
    });
    (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients.set('stale-2', {
      client: { close: staleCloseWithError },
      signature: 'old'
    });
    // Action
    await (service as unknown as {
      applyOverridesToOpenTargets: (cdpHost: string, cdpPort: number) => Promise<void>;
    }).applyOverridesToOpenTargets('127.0.0.1', 9222);
    // Assert
    expect(ensureSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page-1' }),
      'page-1',
      expect.objectContaining({ signature: expect.any(String) }),
      '127.0.0.1',
      9222
    );
    expect(staleClose).toHaveBeenCalledTimes(1);
    expect(staleCloseWithError).toHaveBeenCalledTimes(1);
    const targetClients = (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients;
    expect(targetClients.has('stale-1')).toBe(false);
    expect(targetClients.has('stale-2')).toBe(false);
  });

  it('whenTargetRemainsActive_applyOverridesToOpenTargets_shouldNotCloseTrackedClient', async () => {
    // Arrange
    const { service } = createService();
    const cdpMock = CDP as unknown as jest.Mock & { List: jest.Mock };
    const cdpListMock = cdpMock.List as unknown as jest.MockedFunction<
      (params: { host: string; port: number }) => Promise<PageTarget[]>
    >;
    cdpListMock.mockResolvedValue([{ id: 'page-keep', type: 'page', url: 'https://keep' }]);
    const keepClose = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients.set('page-keep', {
      client: { close: keepClose },
      signature: 'sig'
    });
    jest.spyOn(
      service as unknown as {
        ensureTargetOverrides: (
          target: PageTarget,
          targetKey: string,
          overrides: HeaderOverrides,
          cdpHost: string,
          cdpPort: number
        ) => Promise<void>;
      },
      'ensureTargetOverrides'
    ).mockResolvedValue(undefined);
    // Action
    await (service as unknown as {
      applyOverridesToOpenTargets: (cdpHost: string, cdpPort: number) => Promise<void>;
    }).applyOverridesToOpenTargets('127.0.0.1', 9222);
    // Assert
    expect(keepClose).not.toHaveBeenCalled();
  });

  it('whenTargetAlreadyHasSameSignature_ensureTargetOverrides_shouldSkipReapply', async () => {
    // Arrange
    const { service } = createService();
    const targetKey = 'page-1';
    const client = { close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) } as CdpNetworkClient & {
      close(): Promise<void>;
    };
    (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients.set(targetKey, { client, signature: 'same' });
    const applySpy = jest.spyOn(
      service as unknown as {
        applyOverridesToClient: (targetClient: CdpNetworkClient, targetOverrides: HeaderOverrides) => Promise<boolean>;
      },
      'applyOverridesToClient'
    );
    // Action
    await (service as unknown as {
      ensureTargetOverrides: (
        target: PageTarget,
        key: string,
        overrides: HeaderOverrides,
        cdpHost: string,
        cdpPort: number
      ) => Promise<void>;
    }).ensureTargetOverrides({ id: targetKey, type: 'page' }, targetKey, {
      userAgentOverride: undefined,
      extraHeaders: {},
      signature: 'same'
    }, '127.0.0.1', 9222);
    // Assert
    expect(applySpy).not.toHaveBeenCalled();
  });

  it('whenTargetSignatureChanges_ensureTargetOverrides_shouldUpdateExistingTargetSignature', async () => {
    // Arrange
    const { service, logger } = createService();
    const targetKey = 'page-2';
    const existingClient = { close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) } as CdpNetworkClient & {
      close(): Promise<void>;
    };
    (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients.set(targetKey, { client: existingClient, signature: 'old' });
    jest.spyOn(
      service as unknown as {
        applyOverridesToClient: (targetClient: CdpNetworkClient, targetOverrides: HeaderOverrides) => Promise<boolean>;
      },
      'applyOverridesToClient'
    ).mockResolvedValue(true);
    // Action
    await (service as unknown as {
      ensureTargetOverrides: (
        target: PageTarget,
        key: string,
        overrides: HeaderOverrides,
        cdpHost: string,
        cdpPort: number
      ) => Promise<void>;
    }).ensureTargetOverrides({ id: targetKey, type: 'page' }, targetKey, {
      userAgentOverride: undefined,
      extraHeaders: {},
      signature: 'new'
    }, '127.0.0.1', 9222);
    // Assert
    const targetClients = (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients;
    expect(targetClients.get(targetKey)?.signature).toBe('new');
    expect(logger.log).toHaveBeenCalledWith('Updated network header overrides for target page-2.');
  });

  it('whenTargetSignatureChangesButReapplyFails_ensureTargetOverrides_shouldKeepPreviousSignature', async () => {
    // Arrange
    const { service, logger } = createService();
    const targetKey = 'page-2b';
    const existingClient = { close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) } as CdpNetworkClient & {
      close(): Promise<void>;
    };
    (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients.set(targetKey, { client: existingClient, signature: 'old' });
    jest.spyOn(
      service as unknown as {
        applyOverridesToClient: (targetClient: CdpNetworkClient, targetOverrides: HeaderOverrides) => Promise<boolean>;
      },
      'applyOverridesToClient'
    ).mockResolvedValue(false);
    // Action
    await (service as unknown as {
      ensureTargetOverrides: (
        target: PageTarget,
        key: string,
        overrides: HeaderOverrides,
        cdpHost: string,
        cdpPort: number
      ) => Promise<void>;
    }).ensureTargetOverrides({ id: targetKey, type: 'page' }, targetKey, {
      userAgentOverride: undefined,
      extraHeaders: {},
      signature: 'new'
    }, '127.0.0.1', 9222);
    // Assert
    const targetClients = (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients;
    expect(targetClients.get(targetKey)?.signature).toBe('old');
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Updated network header overrides'));
  });

  it('whenNewTargetAppliesSuccessfully_ensureTargetOverrides_shouldTrackClientAndLog', async () => {
    // Arrange
    const { service, logger } = createService();
    const target = { id: 'page-3-success', type: 'page' };
    const targetClient = { close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) } as CdpNetworkClient & {
      close(): Promise<void>;
    };
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<CdpNetworkClient & { close(): Promise<void> }>
    >;
    cdpMock.mockResolvedValue(targetClient);
    jest.spyOn(
      service as unknown as {
        applyOverridesToClient: (targetClient: CdpNetworkClient, targetOverrides: HeaderOverrides) => Promise<boolean>;
      },
      'applyOverridesToClient'
    ).mockResolvedValue(true);
    // Action
    await (service as unknown as {
      ensureTargetOverrides: (
        pageTarget: PageTarget,
        key: string,
        overrides: HeaderOverrides,
        cdpHost: string,
        cdpPort: number
      ) => Promise<void>;
    }).ensureTargetOverrides(target, 'page-3-success', {
      userAgentOverride: undefined,
      extraHeaders: {},
      signature: 'sig-success'
    }, '127.0.0.1', 9222);
    // Assert
    const targetClients = (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients;
    expect(targetClients.get('page-3-success')).toEqual({
      client: targetClient,
      signature: 'sig-success'
    });
    expect(logger.log).toHaveBeenCalledWith('Applied network header overrides for target page-3-success.');
  });

  it('whenNewTargetCannotApplyOverrides_ensureTargetOverrides_shouldCloseClientWithoutTracking', async () => {
    // Arrange
    const { service } = createService();
    const target = { id: 'page-3', type: 'page' };
    const targetClient = { close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) } as CdpNetworkClient & {
      close(): Promise<void>;
    };
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<CdpNetworkClient & { close(): Promise<void> }>
    >;
    cdpMock.mockResolvedValue(targetClient);
    jest.spyOn(
      service as unknown as {
        applyOverridesToClient: (targetClient: CdpNetworkClient, targetOverrides: HeaderOverrides) => Promise<boolean>;
      },
      'applyOverridesToClient'
    ).mockResolvedValue(false);
    // Action
    await (service as unknown as {
      ensureTargetOverrides: (
        pageTarget: PageTarget,
        key: string,
        overrides: HeaderOverrides,
        cdpHost: string,
        cdpPort: number
      ) => Promise<void>;
    }).ensureTargetOverrides(target, 'page-3', {
      userAgentOverride: undefined,
      extraHeaders: {},
      signature: 'sig'
    }, '127.0.0.1', 9222);
    // Assert
    expect(targetClient.close).toHaveBeenCalledTimes(1);
    const targetClients = (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients;
    expect(targetClients.has('page-3')).toBe(false);
  });

  it('whenCreatingNewTargetFails_ensureTargetOverrides_shouldWarnAndDropExistingEntry', async () => {
    // Arrange
    const { service, logger } = createService();
    const failingClose = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('close fail'));
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<CdpNetworkClient & { close(): Promise<void> }>
    >;
    cdpMock.mockImplementation(() => {
      (service as unknown as {
        targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
      }).targetClients.set('page-4', {
        client: { close: failingClose },
        signature: 'stale'
      });
      throw new Error('connect failure');
    });
    // Action
    await (service as unknown as {
      ensureTargetOverrides: (
        pageTarget: PageTarget,
        key: string,
        overrides: HeaderOverrides,
        cdpHost: string,
        cdpPort: number
      ) => Promise<void>;
    }).ensureTargetOverrides({ id: 'page-4', type: 'page' }, 'page-4', {
      userAgentOverride: undefined,
      extraHeaders: {},
      signature: 'sig'
    }, '127.0.0.1', 9222);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to apply network headers for page-4.'));
    expect(failingClose).toHaveBeenCalledTimes(1);
    const targetClients = (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients;
    expect(targetClients.has('page-4')).toBe(false);
  });

  it('whenCreatingNewTargetFailsWithoutExisting_ensureTargetOverrides_shouldWarnAndKeepMapUntouched', async () => {
    // Arrange
    const { service, logger } = createService();
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<CdpNetworkClient & { close(): Promise<void> }>
    >;
    cdpMock.mockRejectedValue(new Error('connect failure without existing'));
    // Action
    await (service as unknown as {
      ensureTargetOverrides: (
        pageTarget: PageTarget,
        key: string,
        overrides: HeaderOverrides,
        cdpHost: string,
        cdpPort: number
      ) => Promise<void>;
    }).ensureTargetOverrides({ id: 'page-4b', type: 'page' }, 'page-4b', {
      userAgentOverride: undefined,
      extraHeaders: {},
      signature: 'sig'
    }, '127.0.0.1', 9222);
    // Assert
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to apply network headers for page-4b.'));
    const targetClients = (service as unknown as {
      targetClients: Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>;
    }).targetClients;
    expect(targetClients.size).toBe(0);
  });

  it('whenBuildingOverrides_buildOverrides_shouldAssembleHeadersMetadataAndSignature', () => {
    // Arrange
    const { service, logger } = createService({
      chromeUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/145.0.7420.0 Safari/537.36',
      chromeAcceptLanguage: 'en-US,en;q=0.9,es;q=0.8',
      chromeExtraHeaders: { DNT: '1' }
    });
    // Action
    const overrides = callBuildOverrides(service);
    const secondOverrides = callBuildOverrides(service);
    // Assert
    expect(overrides.extraHeaders).toEqual({
      DNT: '1',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
    });
    expect(overrides.userAgentOverride).toEqual(expect.objectContaining({
      userAgent: expect.stringContaining('Chrome/145.0.7420.0'),
      acceptLanguage: 'en-US,en,es',
      platform: 'MacIntel'
    }));
    expect(overrides.signature.length).toBeGreaterThan(0);
    expect(secondOverrides.signature).toBe(overrides.signature);
    expect(logger.log).toHaveBeenCalledWith('CDP acceptLanguage normalized from "en-US,en;q=0.9,es;q=0.8" to "en-US,en,es".');
    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  it('whenAcceptLanguageAlreadyExists_buildOverrides_shouldPreserveConfiguredHeaderValue', () => {
    // Arrange
    const { service } = createService({
      chromeAcceptLanguage: 'en-US,en;q=0.9',
      chromeExtraHeaders: { 'Accept-Language': 'es-ES,es;q=0.9', DNT: '1' }
    });
    // Action
    const overrides = callBuildOverrides(service);
    // Assert
    expect(overrides.extraHeaders['Accept-Language']).toBe('es-ES,es;q=0.9');
  });

  it('whenNoUserAgentCanBeResolved_buildOverrides_shouldSkipUserAgentOverride', () => {
    // Arrange
    const { service } = createService({
      resolvedUserAgent: '',
      browserVersion: undefined
    });
    // Action
    const overrides = callBuildOverrides(service);
    // Assert
    expect(overrides.userAgentOverride).toBeUndefined();
  });

  it('whenAcceptLanguageIsEmpty_toCdpAcceptLanguage_shouldReturnUndefined', () => {
    // Arrange
    const { service } = createService();
    // Action
    const emptyResult = callToCdpAcceptLanguage(service, '');
    const invalidResult = callToCdpAcceptLanguage(service, ', ; ;');
    // Assert
    expect(emptyResult).toBeUndefined();
    expect(invalidResult).toBeUndefined();
  });

  it('whenAcceptLanguageNeedsNoNormalization_toCdpAcceptLanguage_shouldReturnAsIsWithoutLogging', () => {
    // Arrange
    const { service, logger } = createService();
    // Action
    const result = callToCdpAcceptLanguage(service, 'en-US,en');
    // Assert
    expect(result).toBe('en-US,en');
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('CDP acceptLanguage normalized'));
  });

  it('whenAcceptLanguageIsNullish_toCdpAcceptLanguage_shouldUseEmptyFallbackBranch', () => {
    // Arrange
    const { service } = createService();
    // Action
    const result = callToCdpAcceptLanguage(service, undefined as unknown as string);
    // Assert
    expect(result).toBeUndefined();
  });

  it('whenUserAgentHasNoChromeVersion_buildUserAgentMetadata_shouldReturnUndefined', () => {
    // Arrange
    const { service } = createService();
    // Action
    const metadata = (service as unknown as {
      buildUserAgentMetadata: (userAgent: string) => unknown;
    }).buildUserAgentMetadata('Mozilla/5.0 Safari/537.36');
    // Assert
    expect(metadata).toBeUndefined();
  });

  it('whenUserAgentIsArmAndMajorOnly_buildUserAgentMetadata_shouldUseFallbackMajorAndArmBitnessBranch', () => {
    // Arrange
    const { service } = createService();
    // Action
    const metadata = (service as unknown as {
      buildUserAgentMetadata: (userAgent: string) => {
        architecture: string;
        bitness: string;
        fullVersionList: Array<{ brand: string; version: string }>;
      } | undefined;
    }).buildUserAgentMetadata('Mozilla/5.0 (Linux arm64) AppleWebKit/537.36 Chrome/145 Safari/537.36');
    // Assert
    expect(metadata).toEqual(expect.objectContaining({
      architecture: 'arm',
      bitness: '64'
    }));
    expect(metadata?.fullVersionList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brand: 'Google Chrome', version: '145' }),
        expect.objectContaining({ brand: 'Chromium', version: '145' })
      ])
    );
  });

  it('whenExtractedVersionHasOnlyMajor_buildUserAgentMetadata_shouldFallbackToMajorInFullVersionList', () => {
    // Arrange
    const { service } = createService();
    jest.spyOn(
      service as unknown as {
        extractChromeVersions: (userAgent: string) => { fullVersion?: string; majorVersion?: string };
      },
      'extractChromeVersions'
    ).mockReturnValue({ majorVersion: '145' });
    // Action
    const metadata = (service as unknown as {
      buildUserAgentMetadata: (userAgent: string) => {
        fullVersionList: Array<{ brand: string; version: string }>;
      } | undefined;
    }).buildUserAgentMetadata('Mozilla/5.0 (X11; Linux x86_64)');
    // Assert
    expect(metadata?.fullVersionList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brand: 'Google Chrome', version: '145' }),
        expect.objectContaining({ brand: 'Chromium', version: '145' })
      ])
    );
  });

  it.each([
    {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Chrome/145.0.7420.0',
      expectedPlatform: 'macOS',
      expectedVersion: '14.4'
    },
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/145.0.7420.0',
      expectedPlatform: 'Windows',
      expectedVersion: '10.0'
    },
    {
      userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel) Chrome/145.0.7420.0',
      expectedPlatform: 'Android',
      expectedVersion: '12'
    },
    {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15',
      expectedPlatform: 'iOS',
      expectedVersion: '17.2'
    },
    {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/145.0.7420.0',
      expectedPlatform: 'Linux',
      expectedVersion: '0.0.0'
    }
  ])('whenPlatformInfoIsExtracted_extractPlatformInfo_shouldSupportAllConfiguredFamilies', ({
    userAgent,
    expectedPlatform,
    expectedVersion
  }) => {
    // Arrange
    const { service } = createService();
    // Action
    const platformInfo = (service as unknown as {
      extractPlatformInfo: (ua: string) => { platform: string; platformVersion: string };
    }).extractPlatformInfo(userAgent);
    // Assert
    expect(platformInfo).toEqual({
      platform: expectedPlatform,
      platformVersion: expectedVersion
    });
  });

  it('whenIosVersionIsMissing_extractPlatformInfo_shouldFallbackToDefaultIosVersion', () => {
    // Arrange
    const { service } = createService();
    // Action
    const platformInfo = (service as unknown as {
      extractPlatformInfo: (ua: string) => { platform: string; platformVersion: string };
    }).extractPlatformInfo('Mozilla/5.0 (iPhone; CPU iPhone like Mac OS X)');
    // Assert
    expect(platformInfo).toEqual({
      platform: 'iOS',
      platformVersion: '0.0.0'
    });
  });

  it('whenArchitectureIsExtracted_extractArchitecture_shouldSupportArmX86AndFallback', () => {
    // Arrange
    const { service } = createService();
    const archDescriptor = Object.getOwnPropertyDescriptor(process, 'arch');
    // Action
    const arm = (service as unknown as { extractArchitecture: (ua: string) => string })
      .extractArchitecture('Mozilla/5.0 arm64');
    const x86 = (service as unknown as { extractArchitecture: (ua: string) => string })
      .extractArchitecture('Mozilla/5.0 x86_64');
    Object.defineProperty(process, 'arch', { value: 'arm64' });
    const fallbackArm = (service as unknown as { extractArchitecture: (ua: string) => string })
      .extractArchitecture('Mozilla/5.0 unknown');
    Object.defineProperty(process, 'arch', { value: 'x64' });
    const fallbackX86 = (service as unknown as { extractArchitecture: (ua: string) => string })
      .extractArchitecture('Mozilla/5.0 unknown');
    // Assert
    expect(arm).toBe('arm');
    expect(x86).toBe('x86');
    expect(fallbackArm).toBe('arm');
    expect(fallbackX86).toBe('x86');
    if (archDescriptor) {
      Object.defineProperty(process, 'arch', archDescriptor);
    }
  });

  it('whenNavigatorPlatformIsBuilt_buildNavigatorPlatform_shouldReturnPlatformSpecificValues', () => {
    // Arrange
    const { service } = createService();
    // Action
    const mac = (service as unknown as { buildNavigatorPlatform: (ua: string) => string | undefined })
      .buildNavigatorPlatform('Mozilla/5.0 (Mac OS X 14_4)');
    const windows = (service as unknown as { buildNavigatorPlatform: (ua: string) => string | undefined })
      .buildNavigatorPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const linuxArm = (service as unknown as { buildNavigatorPlatform: (ua: string) => string | undefined })
      .buildNavigatorPlatform('Mozilla/5.0 (Linux arm64)');
    const linuxX86 = (service as unknown as { buildNavigatorPlatform: (ua: string) => string | undefined })
      .buildNavigatorPlatform('Mozilla/5.0 (Linux x86_64)');
    const unknown = (service as unknown as { buildNavigatorPlatform: (ua: string) => string | undefined })
      .buildNavigatorPlatform('Mozilla/5.0 (Solaris)');
    // Assert
    expect(mac).toBe('MacIntel');
    expect(windows).toBe('Win32');
    expect(linuxArm).toBe('Linux armv8l');
    expect(linuxX86).toBe('Linux x86_64');
    expect(unknown).toBeUndefined();
  });

  it('whenTargetKeyIsResolved_getTargetKey_shouldUseIdThenTargetIdThenUrl', () => {
    // Arrange
    const { service } = createService();
    // Action
    const byId = (service as unknown as { getTargetKey: (target: PageTarget) => string | undefined })
      .getTargetKey({ id: 'id-1', targetId: 'target-1', url: 'https://example.com' });
    const byTargetId = (service as unknown as { getTargetKey: (target: PageTarget) => string | undefined })
      .getTargetKey({ targetId: 'target-2', url: 'https://example.com' });
    const byUrl = (service as unknown as { getTargetKey: (target: PageTarget) => string | undefined })
      .getTargetKey({ url: '  https://example.com/path ' });
    const empty = (service as unknown as { getTargetKey: (target: PageTarget) => string | undefined })
      .getTargetKey({ url: undefined });
    // Assert
    expect(byId).toBe('id-1');
    expect(byTargetId).toBe('target-2');
    expect(byUrl).toBe('https://example.com/path');
    expect(empty).toBeUndefined();
  });
});
