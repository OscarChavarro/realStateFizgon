import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'application/services/chromium/chromium-network-headers.service';
import { ChromiumPageTargetService } from 'application/services/chromium/chromium-page-target.service';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { ScrapeNewPropertiesFlowService } from 'application/services/scraper/flows/scrape-new-properties-flow.service';
import { ExecuteScrapeNewPropertiesCycleUseCase } from 'application/usecases/chromium/execute-scrape-new-properties-cycle.use-case';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
jest.mock('chrome-remote-interface', () => jest.fn());

type PageTarget = { id?: string; type?: string; url?: string };

class ScraperConfigMockForExecuteScrapeNewPropertiesCycleUseCase {
  readonly scraperHomeUrl = 'https://www.idealista.com/venta-viviendas/';
}

class ChromiumPageTargetServiceMockForExecuteScrapeNewPropertiesCycleUseCase {
  readonly waitForPageTarget = jest.fn<(host: string, port: number) => Promise<PageTarget | undefined>>();
}

class ChromiumNetworkHeadersServiceMockForExecuteScrapeNewPropertiesCycleUseCase {
  readonly applyHeaders = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

class ChromiumGeolocationServiceMockForExecuteScrapeNewPropertiesCycleUseCase {
  readonly registerPageNavigationListener = jest.fn<(client: ScraperCdpClient, page: ScraperCdpClient['Page']) => void>();
  readonly ensureOriginIsAuthorized = jest.fn<(client: ScraperCdpClient, origin: string) => Promise<void>>();
  readonly applyGeolocationOverride = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

class ImageDownloaderMockForExecuteScrapeNewPropertiesCycleUseCase {
  readonly initializeNetworkCapture = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

class ScrapeNewPropertiesFlowServiceMockForExecuteScrapeNewPropertiesCycleUseCase {
  readonly execute = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

function createClient(): ScraperCdpClient {
  return {
    Page: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      bringToFront: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      navigate: jest.fn<(params: { url: string }) => Promise<void>>().mockResolvedValue(undefined),
      reload: jest.fn<(params?: { ignoreCache?: boolean }) => Promise<void>>().mockResolvedValue(undefined),
      loadEventFired: jest.fn<(cb: () => void) => void>(),
      frameNavigated: jest.fn<(cb: (event: { frame?: { url?: string } }) => void) => void>()
    },
    Runtime: {
      enable: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      evaluate: jest.fn(async () => ({ result: { value: true } }))
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
  const scraperConfig = new ScraperConfigMockForExecuteScrapeNewPropertiesCycleUseCase();
  const chromiumPageTargetService = new ChromiumPageTargetServiceMockForExecuteScrapeNewPropertiesCycleUseCase();
  const chromiumNetworkHeadersService = new ChromiumNetworkHeadersServiceMockForExecuteScrapeNewPropertiesCycleUseCase();
  chromiumNetworkHeadersService.applyHeaders.mockResolvedValue(undefined);
  const chromiumGeolocationService = new ChromiumGeolocationServiceMockForExecuteScrapeNewPropertiesCycleUseCase();
  chromiumGeolocationService.ensureOriginIsAuthorized.mockResolvedValue(undefined);
  chromiumGeolocationService.applyGeolocationOverride.mockResolvedValue(undefined);
  const imageDownloader = new ImageDownloaderMockForExecuteScrapeNewPropertiesCycleUseCase();
  imageDownloader.initializeNetworkCapture.mockResolvedValue(undefined);
  const scrapeNewPropertiesFlowService = new ScrapeNewPropertiesFlowServiceMockForExecuteScrapeNewPropertiesCycleUseCase();
  scrapeNewPropertiesFlowService.execute.mockResolvedValue(undefined);
  const useCase = new ExecuteScrapeNewPropertiesCycleUseCase(
    scraperConfig as unknown as ScraperConfig,
    chromiumPageTargetService as unknown as ChromiumPageTargetService,
    chromiumGeolocationService as unknown as ChromiumGeolocationService,
    chromiumNetworkHeadersService as unknown as ChromiumNetworkHeadersService,
    imageDownloader as unknown as ImageDownloaderService,
    scrapeNewPropertiesFlowService as unknown as ScrapeNewPropertiesFlowService
  );
  const logger = {
    log: jest.fn<(message: string) => void>(),
    warn: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (useCase as unknown as { logger: typeof logger }).logger = logger;

  return {
    useCase,
    scraperConfig,
    chromiumPageTargetService,
    chromiumNetworkHeadersService,
    chromiumGeolocationService,
    imageDownloader,
    scrapeNewPropertiesFlowService,
    logger
  };
}

describe('ExecuteScrapeNewPropertiesCycleUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenPageTargetIsMissing_execute_shouldThrowAndSkipCdpClientCreation', async () => {
    // Arrange
    const { useCase, chromiumPageTargetService } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue(undefined);
    const cdpMock = CDP as unknown as jest.Mock;
    // Action
    const action = useCase.execute('127.0.0.1', 9222);
    // Assert
    await expect(action).rejects.toThrow('No page target available in Chrome');
    expect(cdpMock).not.toHaveBeenCalled();
  });

  it('whenScrapeCycleRuns_execute_shouldHardenClientAndRunScrapeFlow', async () => {
    // Arrange
    const {
      useCase,
      scraperConfig,
      chromiumPageTargetService,
      chromiumNetworkHeadersService,
      chromiumGeolocationService,
      imageDownloader,
      scrapeNewPropertiesFlowService,
      logger
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ id: 'target-42', type: 'page' });
    const client = createClient();
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<ScraperCdpClient>
    >;
    cdpMock.mockResolvedValue(client);
    // Action
    await useCase.execute('127.0.0.1', 9222);
    // Assert
    expect(client.Page.enable).toHaveBeenCalledTimes(1);
    expect(client.Runtime.enable).toHaveBeenCalledTimes(1);
    expect(chromiumNetworkHeadersService.applyHeaders).toHaveBeenCalledWith(client);
    expect(chromiumGeolocationService.registerPageNavigationListener).toHaveBeenCalledWith(client, client.Page);
    expect(chromiumGeolocationService.ensureOriginIsAuthorized).toHaveBeenCalledWith(client, scraperConfig.scraperHomeUrl);
    expect(chromiumGeolocationService.applyGeolocationOverride).toHaveBeenCalledWith(client);
    expect(imageDownloader.initializeNetworkCapture).toHaveBeenCalledWith(client);
    expect(client.Page.bringToFront).toHaveBeenCalledTimes(1);
    expect(scrapeNewPropertiesFlowService.execute).toHaveBeenCalledWith(client);
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Using page target target-42 for SCRAPING_FOR_NEW_PROPERTIES state.');
  });

  it('whenScrapeFlowThrows_execute_shouldCloseClientAndUseUnknownTargetFallback', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService,
      scrapeNewPropertiesFlowService,
      logger
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ type: 'page' });
    const client = createClient();
    scrapeNewPropertiesFlowService.execute.mockRejectedValue(new Error('scrape flow failed'));
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<ScraperCdpClient>
    >;
    cdpMock.mockResolvedValue(client);
    // Action
    const action = useCase.execute('127.0.0.1', 9222);
    // Assert
    await expect(action).rejects.toThrow('scrape flow failed');
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Using page target unknown for SCRAPING_FOR_NEW_PROPERTIES state.');
  });
});
