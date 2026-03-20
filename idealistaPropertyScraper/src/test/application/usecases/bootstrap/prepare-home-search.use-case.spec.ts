import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'application/services/chromium/chromium-network-headers.service';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { ChromiumPageTargetService } from 'application/services/chromium/chromium-page-target.service';
import { PrepareHomeSearchUseCase } from 'application/usecases/bootstrap/prepare-home-search.use-case';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
jest.mock('chrome-remote-interface', () => jest.fn());

type PageTarget = { id?: string; type?: string; url?: string };

class ChromeConfigMockForPrepareHomeSearchUseCase {
  readonly chromeCdpReadyTimeoutMs = 5000;
  readonly chromeCdpPollIntervalMs = 100;
}

class ScraperConfigMockForPrepareHomeSearchUseCase {
  readonly scraperHomeUrl = 'https://www.idealista.com/venta-viviendas/';
}

class ChromiumPageSyncServiceMockForPrepareHomeSearchUseCase {
  readonly waitForPageLoad = jest.fn<
    (
      page: ScraperCdpClient['Page'],
      runtime: ScraperCdpClient['Runtime'],
      timeoutMs: number,
      pollIntervalMs: number
    ) => Promise<void>
  >();
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class ChromiumPageTargetServiceMockForPrepareHomeSearchUseCase {
  readonly waitForPageTarget = jest.fn<(host: string, port: number) => Promise<PageTarget | undefined>>();
}

class ChromiumNetworkHeadersServiceMockForPrepareHomeSearchUseCase {
  readonly applyHeaders = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

class ChromiumGeolocationServiceMockForPrepareHomeSearchUseCase {
  readonly registerPageNavigationListener = jest.fn<(client: ScraperCdpClient, page: ScraperCdpClient['Page']) => void>();
  readonly ensureOriginIsAuthorized = jest.fn<(client: ScraperCdpClient, origin: string) => Promise<void>>();
  readonly applyGeolocationOverride = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

function createClient(initialUrlValue: unknown = 'about:blank', failOnPageEnable = false): ScraperCdpClient {
  const pageEnable = jest.fn<() => Promise<void>>();
  if (failOnPageEnable) {
    pageEnable.mockRejectedValue(new Error('enable failed'));
  } else {
    pageEnable.mockResolvedValue(undefined);
  }
  return {
    Page: {
      enable: pageEnable,
      bringToFront: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      navigate: jest.fn<(params: { url: string }) => Promise<void>>().mockResolvedValue(undefined),
      reload: jest.fn<(params?: { ignoreCache?: boolean }) => Promise<void>>().mockResolvedValue(undefined),
      loadEventFired: jest.fn<(cb: () => void) => void>(),
      frameNavigated: jest.fn<(cb: (event: { frame?: { url?: string } }) => void) => void>()
    },
    Runtime: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      evaluate: jest.fn(async () => ({ result: { value: initialUrlValue } }))
    },
    Network: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      responseReceived: jest.fn(),
      loadingFinished: jest.fn(),
      loadingFailed: jest.fn(),
      getResponseBody: jest.fn(async () => ({ body: '', base64Encoded: false }))
    },
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };
}

function createUseCase() {
  const chromeConfig = new ChromeConfigMockForPrepareHomeSearchUseCase();
  const scraperConfig = new ScraperConfigMockForPrepareHomeSearchUseCase();
  const chromiumPageSyncService = new ChromiumPageSyncServiceMockForPrepareHomeSearchUseCase();
  chromiumPageSyncService.waitForPageLoad.mockResolvedValue(undefined);
  chromiumPageSyncService.sleep.mockResolvedValue(undefined);
  const chromiumPageTargetService = new ChromiumPageTargetServiceMockForPrepareHomeSearchUseCase();
  const chromiumNetworkHeadersService = new ChromiumNetworkHeadersServiceMockForPrepareHomeSearchUseCase();
  chromiumNetworkHeadersService.applyHeaders.mockResolvedValue(undefined);
  const chromiumGeolocationService = new ChromiumGeolocationServiceMockForPrepareHomeSearchUseCase();
  chromiumGeolocationService.ensureOriginIsAuthorized.mockResolvedValue(undefined);
  chromiumGeolocationService.applyGeolocationOverride.mockResolvedValue(undefined);
  const useCase = new PrepareHomeSearchUseCase(
    chromeConfig as unknown as ChromeConfig,
    scraperConfig as unknown as ScraperConfig,
    chromiumPageSyncService as unknown as ChromiumPageSyncService,
    chromiumPageTargetService as unknown as ChromiumPageTargetService,
    chromiumNetworkHeadersService as unknown as ChromiumNetworkHeadersService,
    chromiumGeolocationService as unknown as ChromiumGeolocationService
  );
  const logger = {
    log: jest.fn<(message: string) => void>(),
    warn: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;

  return {
    useCase,
    scraperConfig,
    chromeConfig,
    chromiumPageSyncService,
    chromiumPageTargetService,
    chromiumNetworkHeadersService,
    chromiumGeolocationService,
    logger
  };
}

describe('PrepareHomeSearchUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenPageTargetIsMissing_execute_shouldThrowAndSkipCdpClientCreation', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue(undefined);
    const cdpMock = CDP as unknown as jest.Mock;
    // Action
    const action = useCase.execute('127.0.0.1', 9222);
    // Assert
    await expect(action).rejects.toThrow('No page target available in Chrome');
    expect(cdpMock).not.toHaveBeenCalled();
  });

  it('whenInitialTargetIsNotBlank_execute_shouldForceBlankThenNavigateToHome', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService,
      chromiumPageSyncService,
      chromiumNetworkHeadersService,
      chromiumGeolocationService,
      scraperConfig,
      chromeConfig,
      logger
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ id: 'target-1', type: 'page' });
    const client = createClient('https://www.idealista.com/not-blank');
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<ScraperCdpClient>
    >;
    cdpMock.mockResolvedValue(client);
    // Action
    await useCase.execute('127.0.0.1', 9222);
    // Assert
    expect(client.Page.navigate).toHaveBeenNthCalledWith(1, { url: 'about:blank' });
    expect(client.Page.navigate).toHaveBeenNthCalledWith(2, { url: scraperConfig.scraperHomeUrl });
    expect(chromiumPageSyncService.waitForPageLoad).toHaveBeenNthCalledWith(
      1,
      client.Page,
      client.Runtime,
      chromeConfig.chromeCdpReadyTimeoutMs,
      chromeConfig.chromeCdpPollIntervalMs
    );
    expect(chromiumPageSyncService.waitForPageLoad).toHaveBeenNthCalledWith(
      2,
      client.Page,
      client.Runtime,
      chromeConfig.chromeCdpReadyTimeoutMs,
      chromeConfig.chromeCdpPollIntervalMs
    );
    expect(chromiumNetworkHeadersService.applyHeaders).toHaveBeenCalledWith(client);
    expect(chromiumGeolocationService.registerPageNavigationListener).toHaveBeenCalledWith(client, client.Page);
    expect(chromiumGeolocationService.ensureOriginIsAuthorized).toHaveBeenCalledWith(client, scraperConfig.scraperHomeUrl);
    expect(chromiumGeolocationService.applyGeolocationOverride).toHaveBeenCalledWith(client);
    expect(chromiumPageSyncService.sleep).toHaveBeenCalledWith(5000);
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Initial target URL is "https://www.idealista.com/not-blank". Forcing about:blank before first hardened navigation.'
    );
  });

  it('whenInitialTargetIsAboutBlank_execute_shouldSkipForcedBlankNavigation', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService,
      chromiumPageSyncService
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ id: 'target-2', type: 'page' });
    const client = createClient('about:blank');
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<ScraperCdpClient>
    >;
    cdpMock.mockResolvedValue(client);
    // Action
    await useCase.execute('127.0.0.1', 9222);
    // Assert
    expect(client.Page.navigate).toHaveBeenCalledTimes(1);
    expect(client.Page.navigate).toHaveBeenCalledWith({ url: 'https://www.idealista.com/venta-viviendas/' });
    expect(chromiumPageSyncService.waitForPageLoad).toHaveBeenCalledTimes(1);
  });

  it('whenPreparationFailsAfterConnecting_execute_shouldAlwaysCloseClient', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ id: 'target-3', type: 'page' });
    const client = createClient('about:blank', true);
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<ScraperCdpClient>
    >;
    cdpMock.mockResolvedValue(client);
    // Action
    const action = useCase.execute('127.0.0.1', 9222);
    // Assert
    await expect(action).rejects.toThrow('enable failed');
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('whenTargetIdAndInitialUrlAreMissing_execute_shouldUseFallbackValues', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService,
      logger
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ type: 'page' });
    const client = createClient(undefined);
    (client.Runtime.evaluate as jest.MockedFunction<ScraperCdpClient['Runtime']['evaluate']>)
      .mockResolvedValue({ result: {} });
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<ScraperCdpClient>
    >;
    cdpMock.mockResolvedValue(client);
    // Action
    await useCase.execute('127.0.0.1', 9222);
    // Assert
    expect(logger.log).toHaveBeenCalledWith('Loading initial home page on target unknown.');
    expect(client.Page.navigate).toHaveBeenNthCalledWith(1, { url: 'about:blank' });
  });
});
