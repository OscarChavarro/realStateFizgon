import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/chromium/chromium-network-headers.service';
import { ChromiumPageTargetService } from 'src/application/services/chromium/chromium-page-target.service';
import { ImageDownloaderService } from 'src/application/services/imagedownload/image-downloader';
import { UpdateExistingPropertiesFlowService } from 'src/application/services/scraper/flows/update-existing-properties-flow.service';
import { ExecuteUpdateExistingPropertiesCycleUseCase } from 'src/application/usecases/chromium/execute-update-existing-properties-cycle.use-case';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

import type { ScraperCdpClient } from 'src/ports/outbound/browser/scraper-cdp-client.port';
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
  readonly initializeNetworkCapture = jest.fn<(client: ScraperCdpClient) => Promise<void>>();
}

class UpdateExistingPropertiesFlowServiceMockForExecuteUpdateExistingPropertiesCycleUseCase {
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
  const scraperConfig = new ScraperConfigMockForExecuteUpdateExistingPropertiesCycleUseCase();
  const chromiumPageTargetService = new ChromiumPageTargetServiceMockForExecuteUpdateExistingPropertiesCycleUseCase();
  const chromiumNetworkHeadersService = new ChromiumNetworkHeadersServiceMockForExecuteUpdateExistingPropertiesCycleUseCase();
  chromiumNetworkHeadersService.applyHeaders.mockResolvedValue(undefined);
  const chromiumGeolocationService = new ChromiumGeolocationServiceMockForExecuteUpdateExistingPropertiesCycleUseCase();
  chromiumGeolocationService.ensureOriginIsAuthorized.mockResolvedValue(undefined);
  chromiumGeolocationService.applyGeolocationOverride.mockResolvedValue(undefined);
  const imageDownloader = new ImageDownloaderMockForExecuteUpdateExistingPropertiesCycleUseCase();
  imageDownloader.initializeNetworkCapture.mockResolvedValue(undefined);
  const updateExistingPropertiesFlowService = new UpdateExistingPropertiesFlowServiceMockForExecuteUpdateExistingPropertiesCycleUseCase();
  updateExistingPropertiesFlowService.execute.mockResolvedValue(undefined);
  const useCase = new ExecuteUpdateExistingPropertiesCycleUseCase(
    scraperConfig as unknown as ScraperConfig,
    chromiumPageTargetService as unknown as ChromiumPageTargetService,
    chromiumGeolocationService as unknown as ChromiumGeolocationService,
    chromiumNetworkHeadersService as unknown as ChromiumNetworkHeadersService,
    imageDownloader as unknown as ImageDownloaderService,
    updateExistingPropertiesFlowService as unknown as UpdateExistingPropertiesFlowService
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
    updateExistingPropertiesFlowService,
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
      updateExistingPropertiesFlowService,
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
    expect(updateExistingPropertiesFlowService.execute).toHaveBeenCalledWith(client);
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Using page target target-42 for UPDATING_PROPERTIES state.');
  });

  it('whenUpdateFlowThrows_execute_shouldCloseClientAndUseUnknownTargetFallback', async () => {
    // Arrange
    const {
      useCase,
      chromiumPageTargetService,
      updateExistingPropertiesFlowService,
      logger
    } = createUseCase();
    chromiumPageTargetService.waitForPageTarget.mockResolvedValue({ type: 'page' });
    const client = createClient();
    updateExistingPropertiesFlowService.execute.mockRejectedValue(new Error('update flow failed'));
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
