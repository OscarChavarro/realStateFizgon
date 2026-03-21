import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'application/services/chromium/chromium-network-headers.service';
import { ChromiumPageTargetService } from 'application/services/chromium/chromium-page-target.service';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { ExecuteUpdateExistingPropertiesCycleUseCase } from 'application/usecases/chromium/execute-update-existing-properties-cycle.use-case';
import { ExecuteUpdateExistingPropertiesFlowUseCase } from 'application/usecases/scraper/execute-update-existing-properties-flow.use-case';

import type { ScrapeRunContext } from 'application/context/scrape-run-context';
import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';
jest.mock('chrome-remote-interface', () => jest.fn());

type PageTarget = { id?: string; type?: string; url?: string };

class ScraperConfigMockForExecuteUpdateExistingPropertiesCycleUseCase {
  readonly scraperHomeUrl = 'https://www.idealista.com/venta-viviendas/';
}

class ChromiumPageTargetServiceMockForExecuteUpdateExistingPropertiesCycleUseCase {
  readonly waitForPageTarget = jest.fn<(host: string, port: number) => Promise<PageTarget | undefined>>();
}

class ChromiumNetworkHeadersServiceMockForExecuteUpdateExistingPropertiesCycleUseCase {
  readonly applyHeaders = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

class ChromiumGeolocationServiceMockForExecuteUpdateExistingPropertiesCycleUseCase {
  readonly registerPageNavigationListener = jest.fn<(client: ScraperCdpClient, page: ScraperCdpClient['Page']) => void>();
  readonly ensureOriginIsAuthorized = jest.fn<(client: ScraperCdpClient, origin: string) => Promise<void>>();
  readonly applyGeolocationOverride = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

class ImageDownloaderMockForExecuteUpdateExistingPropertiesCycleUseCase {
  readonly initializeNetworkCapture = jest.fn<
    (client: ScraperCdpClient, scrapeRunContext: ScrapeRunContext) => Promise<void>
  >();
}

class ExecuteUpdateExistingPropertiesFlowUseCaseMockForExecuteUpdateExistingPropertiesCycleUseCase {
  readonly execute = jest.fn<
    (client: ScraperCdpClient, scrapeRunContext: ScrapeRunContext) => Promise<void>
  >();
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
  const scraperConfig = new ScraperConfigMockForExecuteUpdateExistingPropertiesCycleUseCase();
  const chromiumPageTargetService = new ChromiumPageTargetServiceMockForExecuteUpdateExistingPropertiesCycleUseCase();
  const chromiumNetworkHeadersService = new ChromiumNetworkHeadersServiceMockForExecuteUpdateExistingPropertiesCycleUseCase();
  chromiumNetworkHeadersService.applyHeaders.mockResolvedValue(undefined);
  const chromiumGeolocationService = new ChromiumGeolocationServiceMockForExecuteUpdateExistingPropertiesCycleUseCase();
  chromiumGeolocationService.ensureOriginIsAuthorized.mockResolvedValue(undefined);
  chromiumGeolocationService.applyGeolocationOverride.mockResolvedValue(undefined);
  const imageDownloader = new ImageDownloaderMockForExecuteUpdateExistingPropertiesCycleUseCase();
  imageDownloader.initializeNetworkCapture.mockResolvedValue(undefined);
  const executeUpdateExistingPropertiesFlowUseCase =
    new ExecuteUpdateExistingPropertiesFlowUseCaseMockForExecuteUpdateExistingPropertiesCycleUseCase();
  executeUpdateExistingPropertiesFlowUseCase.execute.mockResolvedValue(undefined);
  const useCase = new ExecuteUpdateExistingPropertiesCycleUseCase(
    scraperConfig as unknown as ScraperSettingsPort,
    chromiumPageTargetService as unknown as ChromiumPageTargetService,
    chromiumGeolocationService as unknown as ChromiumGeolocationService,
    chromiumNetworkHeadersService as unknown as ChromiumNetworkHeadersService,
    imageDownloader as unknown as ImageDownloaderService,
    executeUpdateExistingPropertiesFlowUseCase as unknown as ExecuteUpdateExistingPropertiesFlowUseCase
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
    executeUpdateExistingPropertiesFlowUseCase,
    logger
  };
}

describe('ExecuteUpdateExistingPropertiesCycleUseCase', () => {
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

  it('whenUpdateCycleRuns_execute_shouldHardenClientAndRunUpdateFlow', async () => {
    // Arrange
    const {
      useCase,
      scraperConfig,
      chromiumPageTargetService,
      chromiumNetworkHeadersService,
      chromiumGeolocationService,
      imageDownloader,
      executeUpdateExistingPropertiesFlowUseCase,
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
    expect(imageDownloader.initializeNetworkCapture).toHaveBeenCalledTimes(1);
    const scrapeRunContext = imageDownloader.initializeNetworkCapture.mock.calls[0]?.[1];
    expect(scrapeRunContext).toEqual(
      expect.objectContaining({
        processedPropertyUrls: expect.any(Set),
        image: expect.any(Object)
      })
    );
    expect(client.Page.bringToFront).toHaveBeenCalledTimes(1);
    expect(executeUpdateExistingPropertiesFlowUseCase.execute).toHaveBeenCalledWith(
      client,
      scrapeRunContext as ScrapeRunContext
    );
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Using page target target-42 for UPDATING_PROPERTIES state.');
  });

  it('whenUpdateFlowThrows_execute_shouldCloseClientAndUseUnknownTargetFallback', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService,
      executeUpdateExistingPropertiesFlowUseCase,
      logger
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ type: 'page' });
    const client = createClient();
    executeUpdateExistingPropertiesFlowUseCase.execute.mockRejectedValue(new Error('update flow failed'));
    const cdpMock = CDP as unknown as jest.MockedFunction<
      (params: { host: string; port: number; target: PageTarget }) => Promise<ScraperCdpClient>
    >;
    cdpMock.mockResolvedValue(client);
    // Action
    const action = useCase.execute('127.0.0.1', 9222);
    // Assert
    await expect(action).rejects.toThrow('update flow failed');
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Using page target unknown for UPDATING_PROPERTIES state.');
  });
});
