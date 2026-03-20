import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ImageDownloadPathService } from 'application/services/imagedownload/image-download-path.service';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';
import { NetworkEnabledCdpClient } from 'application/services/imagedownload/network-enabled-cdp-client.type';
import { FinalizePropertyImagesUseCase } from 'application/usecases/imagedownload/finalize-property-images.use-case';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { Property } from 'domain/property/property.model';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group.model';
import { PropertyImage } from 'domain/property/property-image.model';
import { PropertyMainFeatures } from 'domain/property/property-main-features.model';

class ChromeConfigMockForDownloader {
  readonly chromeBrowserLaunchRetryWaitMs = 1000;
}

class ScraperConfigMockForDownloader {
  readonly imageDownloadFolder = '/tmp/images';
}

class ImageDownloadPathServiceMock {
  readonly ensureWritableFolders = jest.fn<(folder: string) => void>();
}

class ImageUrlRulesServiceMock {
  readonly isIdealistaDomain = jest.fn<(url: string) => boolean>();
}

class ImageNetworkCaptureServiceMock {
  readonly isInitialized = jest.fn<(client: object) => boolean>();
  readonly markInitialized = jest.fn<(client: object) => void>();
  readonly trackResponseReceived = jest.fn<(event: unknown, isAllowed: (url: string) => boolean) => void>();
  readonly trackLoadingFinished = jest.fn<(network: unknown, event: unknown, onImageBody: (payload: unknown) => Promise<void>, logger: unknown) => void>();
  readonly trackLoadingFailed = jest.fn<(event: unknown) => void>();
  readonly waitForPendingImageDownloads = jest.fn<(timeoutMs: number) => Promise<void>>();
  readonly waitForImageNetworkSettled = jest.fn<(logger: unknown, maxWaitMs: number, quietWindowMs: number) => Promise<void>>();
}

class FinalizePropertyImagesUseCaseMock {
  readonly execute = jest.fn<(property: Property) => Promise<void>>();
  readonly persistCapturedImage = jest.fn<(payload: unknown) => Promise<void>>();
}

type SleepPortMock = {
  sleep: jest.Mock<(ms: number) => Promise<void>>;
};

type ErrorMessagePortMock = {
  toErrorMessage: jest.Mock<(error: unknown) => string>;
};

type FakeNetwork = {
  enable: jest.Mock<() => Promise<void>>;
  responseReceived: jest.Mock<(callback: (event: unknown) => void) => void>;
  loadingFinished: jest.Mock<(callback: (event: unknown) => void) => void>;
  loadingFailed: jest.Mock<(callback: (event: unknown) => void) => void>;
  getResponseBody: jest.Mock<(params: { requestId: string }) => Promise<{ body: string; base64Encoded: boolean }>>;
};

function createClient(network?: FakeNetwork): NetworkEnabledCdpClient {
  const resolvedNetwork = network ?? {
    enable: jest.fn(async () => undefined),
    responseReceived: jest.fn(),
    loadingFinished: jest.fn(),
    loadingFailed: jest.fn(),
    getResponseBody: jest.fn(async () => ({ body: '', base64Encoded: false }))
  };
  return { Network: resolvedNetwork };
}

function createProperty(url: string, images: PropertyImage[]): Property {
  return new Property(
    '123',
    url,
    'Title',
    'Madrid',
    1000,
    new PropertyMainFeatures('80 m2', '2', 'Exterior', []),
    'Comment',
    [new PropertyFeatureGroup('General', ['Ascensor'])],
    'hace 2 dias',
    images
  );
}

function createService() {
  const pathService = new ImageDownloadPathServiceMock();
  const urlRules = new ImageUrlRulesServiceMock();
  const networkCapture = new ImageNetworkCaptureServiceMock();
  const finalizeUseCase = new FinalizePropertyImagesUseCaseMock();
  const errorMessagePort: ErrorMessagePortMock = {
    toErrorMessage: jest.fn((error: unknown) => (error instanceof Error ? error.message : String(error)))
  };
  const sleepPort: SleepPortMock = {
    sleep: jest.fn(async () => undefined)
  };
  const service = new ImageDownloaderService(
    new ChromeConfigMockForDownloader() as unknown as ChromeConfig,
    new ScraperConfigMockForDownloader() as unknown as ScraperConfig,
    pathService as unknown as ImageDownloadPathService,
    urlRules as unknown as ImageUrlRulesService,
    networkCapture as unknown as ImageNetworkCaptureService,
    finalizeUseCase as unknown as FinalizePropertyImagesUseCase,
    errorMessagePort as never,
    sleepPort as never
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  (service as unknown as { logger: typeof logger }).logger = logger;
  return { service, pathService, urlRules, networkCapture, finalizeUseCase, logger, sleepPort, errorMessagePort };
}

describe('ImageDownloaderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('whenFolderIsWritable_validateImageDownloadFolder_shouldReturnWithoutRetry', async () => {
    // Arrange
    const { service, pathService, sleepPort } = createService();
    pathService.ensureWritableFolders.mockImplementation(() => undefined);
    // Action
    await service.validateImageDownloadFolder();
    // Assert
    expect(pathService.ensureWritableFolders).toHaveBeenCalledWith('/tmp/images');
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenFolderValidationFailsOnce_validateImageDownloadFolder_shouldRetryAfterSleep', async () => {
    // Arrange
    const { service, pathService, logger, sleepPort } = createService();
    pathService.ensureWritableFolders
      .mockImplementationOnce(() => {
        throw new Error('permission denied');
      })
      .mockImplementation(() => undefined);
    // Action
    await service.validateImageDownloadFolder();
    // Assert
    expect(pathService.ensureWritableFolders).toHaveBeenCalledTimes(2);
    expect(sleepPort.sleep).toHaveBeenCalledWith(1000);
    expect(logger.error).toHaveBeenCalled();
  });

  it('whenClientAlreadyInitialized_initializeNetworkCapture_shouldSkipInitialization', async () => {
    // Arrange
    const { service, networkCapture } = createService();
    const client = createClient();
    networkCapture.isInitialized.mockReturnValue(true);
    // Action
    await service.initializeNetworkCapture(client);
    // Assert
    expect(client.Network.enable).not.toHaveBeenCalled();
    expect(networkCapture.markInitialized).not.toHaveBeenCalled();
  });

  it('whenClientNeedsInitialization_initializeNetworkCapture_shouldRegisterDelegatingListeners', async () => {
    // Arrange
    const { service, networkCapture, urlRules } = createService();
    networkCapture.isInitialized.mockReturnValue(false);
    urlRules.isIdealistaDomain.mockReturnValue(true);
    const network: FakeNetwork = {
      enable: jest.fn(async () => undefined),
      responseReceived: jest.fn(),
      loadingFinished: jest.fn(),
      loadingFailed: jest.fn(),
      getResponseBody: jest.fn(async () => ({ body: '', base64Encoded: false }))
    };
    const client = createClient(network);
    // Action
    await service.initializeNetworkCapture(client);
    const responseCallback = network.responseReceived.mock.calls[0]?.[0] as (event: unknown) => void;
    const finishedCallback = network.loadingFinished.mock.calls[0]?.[0] as (event: unknown) => void;
    const failedCallback = network.loadingFailed.mock.calls[0]?.[0] as (event: unknown) => void;
    responseCallback?.({ requestId: 'a' });
    finishedCallback?.({ requestId: 'b' });
    failedCallback?.({ requestId: 'c' });
    // Assert
    expect(network.enable).toHaveBeenCalledTimes(1);
    expect(networkCapture.markInitialized).toHaveBeenCalledWith(client);
    expect(networkCapture.trackResponseReceived).toHaveBeenCalled();
    expect(networkCapture.trackLoadingFinished).toHaveBeenCalled();
    expect(networkCapture.trackLoadingFailed).toHaveBeenCalledWith({ requestId: 'c' });
  });

  it('whenResponseDelegatorIsInvoked_initializeNetworkCapture_shouldDelegateDomainCheckToUrlRules', async () => {
    // Arrange
    const { service, networkCapture, urlRules } = createService();
    networkCapture.isInitialized.mockReturnValue(false);
    urlRules.isIdealistaDomain.mockReturnValue(true);
    const client = createClient();
    // Action
    await service.initializeNetworkCapture(client);
    const responseReceivedMock = client.Network.responseReceived as unknown as jest.Mock;
    const responseCallback = responseReceivedMock.mock.calls[0]?.[0] as ((event: unknown) => void) | undefined;
    responseCallback?.({ requestId: 'req-domain' });
    const isAllowedDomain = networkCapture.trackResponseReceived.mock.calls[0]?.[1];
    const allowed = isAllowedDomain ? isAllowedDomain('https://img4.idealista.com/blur/x.jpg') : false;
    // Assert
    expect(allowed).toBe(true);
    expect(urlRules.isIdealistaDomain).toHaveBeenCalledWith('https://img4.idealista.com/blur/x.jpg');
  });

  it('whenLoadingFinishedCallbackDispatchesImage_initializeNetworkCapture_shouldForwardPayloadToFinalizeUseCase', async () => {
    // Arrange
    const { service, networkCapture, finalizeUseCase } = createService();
    networkCapture.isInitialized.mockReturnValue(false);
    finalizeUseCase.persistCapturedImage.mockResolvedValue(undefined);
    const client = createClient();
    // Action
    await service.initializeNetworkCapture(client);
    const loadingFinishedMock = client.Network.loadingFinished as unknown as jest.Mock;
    const loadingFinishedCallback = loadingFinishedMock.mock.calls[0]?.[0] as ((event: unknown) => void) | undefined;
    loadingFinishedCallback?.({ requestId: 'req-on-body' });
    const onImageBody = networkCapture.trackLoadingFinished.mock.calls[0]?.[2];
    await onImageBody?.({
      requestId: 'req-on-body',
      url: 'https://img4.idealista.com/blur/x.jpg',
      mimeType: 'image/jpeg',
      body: { body: 'abc', base64Encoded: false }
    });
    // Assert
    expect(finalizeUseCase.persistCapturedImage).toHaveBeenCalledWith({
      requestId: 'req-on-body',
      url: 'https://img4.idealista.com/blur/x.jpg',
      mimeType: 'image/jpeg',
      body: { body: 'abc', base64Encoded: false }
    });
  });

  it('whenPendingDownloadWaitIsRequested_waitForPendingImageDownloads_shouldDelegateToNetworkCapture', async () => {
    // Arrange
    const { service, networkCapture } = createService();
    networkCapture.waitForPendingImageDownloads.mockResolvedValue(undefined);
    // Action
    await service.waitForPendingImageDownloads(4321);
    // Assert
    expect(networkCapture.waitForPendingImageDownloads).toHaveBeenCalledWith(4321);
  });

  it('whenPendingDownloadWaitUsesDefault_waitForPendingImageDownloads_shouldDelegateWithDefaultTimeout', async () => {
    // Arrange
    const { service, networkCapture } = createService();
    networkCapture.waitForPendingImageDownloads.mockResolvedValue(undefined);
    // Action
    await service.waitForPendingImageDownloads();
    // Assert
    expect(networkCapture.waitForPendingImageDownloads).toHaveBeenCalledWith(15000);
  });

  it('whenNetworkSettleWaitIsRequested_waitForImageNetworkSettled_shouldDelegateToNetworkCapture', async () => {
    // Arrange
    const { service, networkCapture, logger } = createService();
    networkCapture.waitForImageNetworkSettled.mockResolvedValue(undefined);
    // Action
    await service.waitForImageNetworkSettled(6543, 321);
    // Assert
    expect(networkCapture.waitForImageNetworkSettled).toHaveBeenCalledWith(logger, 6543, 321);
  });

  it('whenNetworkSettleWaitUsesDefault_waitForImageNetworkSettled_shouldDelegateWithDefaultWindows', async () => {
    // Arrange
    const { service, networkCapture, logger } = createService();
    networkCapture.waitForImageNetworkSettled.mockResolvedValue(undefined);
    // Action
    await service.waitForImageNetworkSettled();
    // Assert
    expect(networkCapture.waitForImageNetworkSettled).toHaveBeenCalledWith(logger, 12000, 1200);
  });

  it('whenFinalizationIsRequested_movePropertyImagesFromIncoming_shouldDelegateToFinalizeUseCase', async () => {
    // Arrange
    const { service, finalizeUseCase } = createService();
    finalizeUseCase.execute.mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/123/', [new PropertyImage('https://img/a.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(finalizeUseCase.execute).toHaveBeenCalledWith(property);
  });
});
