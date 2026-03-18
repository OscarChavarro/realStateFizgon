import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ImageFileNameService } from 'src/application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'src/application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'src/application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';
import { NetworkEnabledCdpClient } from 'src/application/services/imagedownload/network-enabled-cdp-client.type';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { sleep } from 'src/infrastructure/sleep';
import { Property } from 'src/domain/property/property.model';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>();

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(async () => undefined),
  readdir: jest.fn(async () => []),
  rename: jest.fn(async () => undefined),
  rm: jest.fn(async () => undefined),
  writeFile: jest.fn(async () => undefined)
}));

jest.mock('src/infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

class ChromeConfigMockForDownloader {
  readonly chromeBrowserLaunchRetryWaitMs = 1000;
}

class ScraperConfigMockForDownloader {
  readonly imageDownloadFolder = '/tmp/images';
}

class ImageDownloadPathServiceMock {
  readonly ensureWritableFolders = jest.fn<(folder: string) => void>();
  readonly getIncomingFolderPath = jest.fn<(folder: string) => string>();
  readonly getDownloadFolderPath = jest.fn<(folder: string) => string>();
  readonly getLeftoversFolderPath = jest.fn<(folder: string) => string>();
}

class ImageUrlRulesServiceMock {
  readonly isIdealistaDomain = jest.fn<(url: string) => boolean>();
  readonly shouldTrackImageUrl = jest.fn<(url: string) => boolean>();
  readonly isSvgImage = jest.fn<(url: string, mimeType: string) => boolean>();
  readonly extractPropertyIdFromUrl = jest.fn<(url: string) => string | null>();
  readonly extractCanonicalImageKey = jest.fn<(url: string) => string | null>();
}

class ImageFileNameServiceMock {
  readonly buildImageFilename = jest.fn<(url: string, mimeType: string) => string>();
  readonly resolveImageExtension = jest.fn<(url: string, mimeType: string) => string>();
  readonly buildCompatibleTargetFilename = jest.fn<(url: string, extension: string) => string>();
  readonly pathExists = jest.fn<(path: string) => Promise<boolean>>();
}

class ImageNetworkCaptureServiceMock {
  readonly isInitialized = jest.fn<(client: object) => boolean>();
  readonly markInitialized = jest.fn<(client: object) => void>();
  readonly trackResponseReceived = jest.fn<(event: unknown, isAllowed: (url: string) => boolean) => void>();
  readonly trackLoadingFinished = jest.fn<(network: unknown, event: unknown, onImageBody: (payload: unknown) => Promise<void>, logger: unknown) => void>();
  readonly trackLoadingFailed = jest.fn<(event: unknown) => void>();
  readonly waitForPendingImageDownloads = jest.fn<(timeoutMs: number) => Promise<void>>();
  readonly waitForImageNetworkSettled = jest.fn<(logger: unknown, maxWaitMs: number, quietWindowMs: number) => Promise<void>>();
  readonly resetPendingRequests = jest.fn<() => void>();
}

class ImagePendingQueuePublisherServiceMock {
  readonly publishPendingImageUrl = jest.fn<(url: string, propertyId: string) => Promise<void>>();
}

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
    'hace 2 días',
    images
  );
}

function createService() {
  const pathService = new ImageDownloadPathServiceMock();
  const urlRules = new ImageUrlRulesServiceMock();
  const fileName = new ImageFileNameServiceMock();
  const networkCapture = new ImageNetworkCaptureServiceMock();
  const pendingPublisher = new ImagePendingQueuePublisherServiceMock();
  const service = new ImageDownloader(
    new ChromeConfigMockForDownloader() as unknown as ChromeConfig,
    new ScraperConfigMockForDownloader() as unknown as ScraperConfig,
    pathService as unknown as ImageDownloadPathService,
    urlRules as unknown as ImageUrlRulesService,
    fileName as unknown as ImageFileNameService,
    networkCapture as unknown as ImageNetworkCaptureService,
    pendingPublisher as unknown as ImagePendingQueuePublisherService
  );
  const logger = {
    warn: jest.fn<(message: string) => void>(),
    log: jest.fn<(message: string) => void>(),
    error: jest.fn<(message: string) => void>()
  };
  fileName.buildImageFilename.mockReturnValue('captured.bin');
  fileName.resolveImageExtension.mockReturnValue('.jpg');
  fileName.buildCompatibleTargetFilename.mockImplementation(
    (_url: string, extension: string) => `image${extension || '.img'}`
  );
  fileName.pathExists.mockResolvedValue(false);
  (service as unknown as { logger: typeof logger }).logger = logger;
  return { service, pathService, urlRules, fileName, networkCapture, pendingPublisher, logger };
}

describe('ImageDownloader', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock
    });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0)
    } as Response);
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: originalFetch
    });
  });

  it('whenFolderIsWritable_validateImageDownloadFolder_shouldReturnWithoutRetry', async () => {
    // Arrange
    const { service, pathService } = createService();
    pathService.ensureWritableFolders.mockImplementation(() => undefined);
    // Action
    await service.validateImageDownloadFolder();
    // Assert
    expect(pathService.ensureWritableFolders).toHaveBeenCalledWith('/tmp/images');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenFolderValidationFailsOnce_validateImageDownloadFolder_shouldRetryAfterSleep', async () => {
    // Arrange
    const { service, pathService, logger } = createService();
    pathService.ensureWritableFolders
      .mockImplementationOnce(() => {
        throw new Error('permission denied');
      })
      .mockImplementation(() => undefined);
    // Action
    await service.validateImageDownloadFolder();
    // Assert
    expect(pathService.ensureWritableFolders).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
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

  it('whenLoadingFinishedCallbackDispatchesImage_initializeNetworkCapture_shouldForwardPayloadToPersistCapturedImage', async () => {
    // Arrange
    const { service, networkCapture } = createService();
    networkCapture.isInitialized.mockReturnValue(false);
    const persistSpy = jest.spyOn(
      service as unknown as {
        persistCapturedImage: (payload: {
          requestId: string;
          url: string;
          mimeType: string;
          body: { body: string; base64Encoded: boolean };
        }) => Promise<void>;
      },
      'persistCapturedImage'
    ).mockResolvedValue(undefined);
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
    expect(persistSpy).toHaveBeenCalledWith({
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

  it('whenPropertyIdCannotBeExtracted_movePropertyImagesFromIncoming_shouldSkipProcessing', async () => {
    // Arrange
    const { service, urlRules, logger } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue(null);
    const property = createProperty('https://www.idealista.com/alquiler-viviendas/madrid/', []);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Unable to extract property id from URL: https://www.idealista.com/alquiler-viviendas/madrid/');
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('whenImageCandidateIsMissing_movePropertyImagesFromIncoming_shouldPublishPendingUrl', async () => {
    // Arrange
    const { service, urlRules, pathService, fileName, pendingPublisher, networkCapture } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('777');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-1');
    fileName.pathExists.mockResolvedValue(false);
    const moveRemainingSpy = jest.spyOn(
      service as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/777/', [new PropertyImage('https://img/a.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(fetchMock).toHaveBeenCalledWith('https://img/a.jpg');
    expect(pendingPublisher.publishPendingImageUrl).toHaveBeenCalledWith('https://img/a.jpg', '777');
    expect(moveRemainingSpy).toHaveBeenCalledWith('/tmp/images/incoming');
    expect(networkCapture.resetPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('whenImageCandidateIsMissingAndDirectFallbackSucceeds_movePropertyImagesFromIncoming_shouldWriteDirectlyAndSkipPendingQueue', async () => {
    // Arrange
    const { service, urlRules, pathService, fileName, pendingPublisher } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('778');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-778');
    fileName.buildCompatibleTargetFilename.mockReturnValue('fallback-778.jpg');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer
    } as Response);
    jest.spyOn(
      service as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/778/', [new PropertyImage('https://img/missing.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(fetchMock).toHaveBeenCalledWith('https://img/missing.jpg');
    expect(writeFile).toHaveBeenCalledWith('/tmp/images/download/778/fallback-778.jpg', Buffer.from([1, 2, 3]));
    expect(pendingPublisher.publishPendingImageUrl).not.toHaveBeenCalled();
  });

  it('whenImageIsNotTrackable_movePropertyImagesFromIncoming_shouldSkipImageProcessing', async () => {
    // Arrange
    const { service, urlRules, pathService, networkCapture } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('701');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(false);
    jest.spyOn(
      service as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/701/', [new PropertyImage('https://img/not-allowed.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(urlRules.extractCanonicalImageKey).not.toHaveBeenCalled();
    expect(networkCapture.resetPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('whenImageKeyCannotBeExtracted_movePropertyImagesFromIncoming_shouldLogAndContinue', async () => {
    // Arrange
    const { service, urlRules, pathService, logger } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('702');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue(null);
    jest.spyOn(
      service as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/702/', [new PropertyImage('https://img/no-key.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Image URL cannot be normalized to a key: https://img/no-key.jpg');
  });

  it('whenSelectedCandidateIsUndefined_movePropertyImagesFromIncoming_shouldPublishPendingUrl', async () => {
    // Arrange
    const { service, urlRules, pathService, pendingPublisher } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('703');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-703');
    jest.spyOn(
      service as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    (service as unknown as { incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string } | undefined>> }).incomingImagesByKey
      .set('key-703', [undefined]);
    const property = createProperty('https://www.idealista.com/inmueble/703/', [new PropertyImage('https://img/undefined.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(pendingPublisher.publishPendingImageUrl).toHaveBeenCalledWith('https://img/undefined.jpg', '703');
  });

  it('whenTargetAlreadyExists_movePropertyImagesFromIncoming_shouldDeleteSourceAndSkipRename', async () => {
    // Arrange
    const { service, urlRules, pathService, fileName, networkCapture } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('888');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-2');
    fileName.buildCompatibleTargetFilename.mockReturnValue('img.jpg');
    fileName.pathExists.mockResolvedValue(true);
    const moveRemainingSpy = jest.spyOn(
      service as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    (service as unknown as { incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string }>> }).incomingImagesByKey
      .set('key-2', [{ url: 'https://img/b.jpg', path: '/tmp/images/incoming/source.jpg', extension: 'jpg' }]);
    const property = createProperty('https://www.idealista.com/inmueble/888/', [new PropertyImage('https://img/b.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(rm).toHaveBeenCalledWith('/tmp/images/incoming/source.jpg', { force: true });
    expect(rename).not.toHaveBeenCalled();
    expect(moveRemainingSpy).toHaveBeenCalled();
    expect(networkCapture.resetPendingRequests).toHaveBeenCalled();
  });

  it('whenRenameFails_movePropertyImagesFromIncoming_shouldLogErrorAndContinue', async () => {
    // Arrange
    const { service, urlRules, pathService, fileName, logger } = createService();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('999');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-3');
    fileName.buildCompatibleTargetFilename.mockReturnValue('img.jpg');
    fileName.pathExists.mockResolvedValue(false);
    (rename as unknown as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('disk issue');
    });
    jest.spyOn(
      service as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    (service as unknown as { incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string }>> }).incomingImagesByKey
      .set('key-3', [{ url: 'https://img/c.jpg', path: '/tmp/images/incoming/source-c.jpg', extension: 'jpg' }]);
    const property = createProperty('https://www.idealista.com/inmueble/999/', [new PropertyImage('https://img/c.jpg', null)]);
    // Action
    await service.movePropertyImagesFromIncoming(property);
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Failed moving image for URL: https://img/c.jpg');
  });

  it('whenPersistCapturedImageReceivesValidBody_persistCapturedImage_shouldStoreImageAndCacheByKey', async () => {
    // Arrange
    const { service, urlRules, pathService, fileName } = createService();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    urlRules.extractCanonicalImageKey.mockReturnValue('canonical-a');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    fileName.buildImageFilename.mockReturnValue('captured.bin');
    fileName.resolveImageExtension.mockReturnValue('jpg');
    // Action
    await (service as unknown as {
      persistCapturedImage: (payload: {
        requestId: string;
        url: string;
        mimeType: string;
        body: { body: string; base64Encoded: boolean };
      }) => Promise<void>;
    }).persistCapturedImage({
      requestId: 'req-1',
      url: 'https://img4.idealista.com/blur/a.jpg',
      mimeType: 'image/jpeg',
      body: { body: Buffer.from('abc').toString('base64'), base64Encoded: true }
    });
    // Assert
    expect(writeFile).toHaveBeenCalledWith('/tmp/images/incoming/captured.bin', expect.any(Buffer));
    const cache = (service as unknown as { incomingImagesByKey: Map<string, Array<{ path: string }>> }).incomingImagesByKey;
    expect(cache.get('canonical-a')?.[0]?.path).toBe('/tmp/images/incoming/captured.bin');
  });

  it('whenPersistCapturedImageReceivesBinaryBody_persistCapturedImage_shouldDecodeUsingBinaryCodec', async () => {
    // Arrange
    const { service, urlRules, pathService, fileName } = createService();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    urlRules.extractCanonicalImageKey.mockReturnValue('canonical-binary');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    fileName.buildImageFilename.mockReturnValue('captured-binary.bin');
    fileName.resolveImageExtension.mockReturnValue('jpg');
    // Action
    await (service as unknown as {
      persistCapturedImage: (payload: {
        requestId: string;
        url: string;
        mimeType: string;
        body: { body: string; base64Encoded: boolean };
      }) => Promise<void>;
    }).persistCapturedImage({
      requestId: 'req-binary',
      url: 'https://img4.idealista.com/blur/binary.jpg',
      mimeType: 'image/jpeg',
      body: { body: 'abc', base64Encoded: false }
    });
    // Assert
    expect(writeFile).toHaveBeenCalledWith('/tmp/images/incoming/captured-binary.bin', Buffer.from('abc', 'binary'));
  });

  it('whenPersistCapturedImageIsUntrackable_persistCapturedImage_shouldSkipDiskWrite', async () => {
    // Arrange
    const { service, urlRules } = createService();
    urlRules.shouldTrackImageUrl.mockReturnValue(false);
    // Action
    await (service as unknown as {
      persistCapturedImage: (payload: {
        requestId: string;
        url: string;
        mimeType: string;
        body: { body: string; base64Encoded: boolean };
      }) => Promise<void>;
    }).persistCapturedImage({
      requestId: 'req-2',
      url: 'https://img4.idealista.com/blur/b.jpg',
      mimeType: 'image/jpeg',
      body: { body: '', base64Encoded: false }
    });
    // Assert
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('whenPersistCapturedImageHasNoBytes_persistCapturedImage_shouldSkipDiskWrite', async () => {
    // Arrange
    const { service, urlRules } = createService();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    // Action
    await (service as unknown as {
      persistCapturedImage: (payload: {
        requestId: string;
        url: string;
        mimeType: string;
        body: { body: string; base64Encoded: boolean };
      }) => Promise<void>;
    }).persistCapturedImage({
      requestId: 'req-3',
      url: 'https://img4.idealista.com/blur/c.jpg',
      mimeType: 'image/jpeg',
      body: { body: '', base64Encoded: true }
    });
    // Assert
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('whenPersistCapturedImageHasNoCanonicalKey_persistCapturedImage_shouldWriteFileWithoutCaching', async () => {
    // Arrange
    const { service, urlRules, pathService, fileName } = createService();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    urlRules.extractCanonicalImageKey.mockReturnValue(null);
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    fileName.buildImageFilename.mockReturnValue('no-key.bin');
    // Action
    await (service as unknown as {
      persistCapturedImage: (payload: {
        requestId: string;
        url: string;
        mimeType: string;
        body: { body: string; base64Encoded: boolean };
      }) => Promise<void>;
    }).persistCapturedImage({
      requestId: 'req-4',
      url: 'https://img4.idealista.com/blur/d.jpg',
      mimeType: 'image/jpeg',
      body: { body: Buffer.from('abc').toString('base64'), base64Encoded: true }
    });
    // Assert
    expect(writeFile).toHaveBeenCalledWith('/tmp/images/incoming/no-key.bin', expect.any(Buffer));
    const cache = (service as unknown as { incomingImagesByKey: Map<string, unknown> }).incomingImagesByKey;
    expect(cache.size).toBe(0);
  });

  it('whenIncomingEntriesContainFilesAndDirectories_moveRemainingIncomingToLeftovers_shouldMoveAndCleanEntries', async () => {
    // Arrange
    const { service, pathService } = createService();
    pathService.getLeftoversFolderPath.mockReturnValue('/tmp/images/leftovers');
    (readdir as unknown as jest.Mock).mockImplementationOnce(async () => [
      { name: 'a.jpg', isFile: () => true, isDirectory: () => false },
      { name: 'folder-a', isFile: () => false, isDirectory: () => true }
    ]);
    // Action
    await (service as unknown as { moveRemainingIncomingToLeftovers: (incomingFolderPath: string) => Promise<void> })
      .moveRemainingIncomingToLeftovers('/tmp/images/incoming');
    // Assert
    expect(mkdir).toHaveBeenCalledWith('/tmp/images/leftovers', { recursive: true });
    expect(rm).toHaveBeenCalledWith('/tmp/images/leftovers/a.jpg', { force: true });
    expect(rename).toHaveBeenCalledWith('/tmp/images/incoming/a.jpg', '/tmp/images/leftovers/a.jpg');
    expect(rm).toHaveBeenCalledWith('/tmp/images/incoming/folder-a', { recursive: true, force: true });
  });

  it('whenIncomingEntryIsNeitherFileNorDirectory_moveRemainingIncomingToLeftovers_shouldIgnoreUnknownEntryType', async () => {
    // Arrange
    const { service, pathService } = createService();
    pathService.getLeftoversFolderPath.mockReturnValue('/tmp/images/leftovers');
    (readdir as unknown as jest.Mock).mockImplementationOnce(async () => [
      { name: 'socket-a', isFile: () => false, isDirectory: () => false }
    ]);
    // Action
    await (service as unknown as { moveRemainingIncomingToLeftovers: (incomingFolderPath: string) => Promise<void> })
      .moveRemainingIncomingToLeftovers('/tmp/images/incoming');
    // Assert
    expect(mkdir).toHaveBeenCalledWith('/tmp/images/leftovers', { recursive: true });
    expect(rename).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalledWith('/tmp/images/incoming/socket-a', { recursive: true, force: true });
  });

  it('whenMultipleCandidatesExist_consumeIncomingImageByKey_shouldKeepRemainingCandidatesMapped', () => {
    // Arrange
    const { service } = createService();
    const map = (service as unknown as {
      incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string }>>;
    }).incomingImagesByKey;
    map.set('canonical-multi', [
      { url: 'https://img/a.jpg', path: '/tmp/a.jpg', extension: 'jpg' },
      { url: 'https://img/b.jpg', path: '/tmp/b.jpg', extension: 'jpg' }
    ]);
    // Action
    const selected = (service as unknown as {
      consumeIncomingImageByKey: (key: string) => { url: string; path: string; extension: string } | undefined;
    }).consumeIncomingImageByKey('canonical-multi');
    // Assert
    expect(selected?.path).toBe('/tmp/a.jpg');
    expect(map.get('canonical-multi')?.length).toBe(1);
    expect(map.get('canonical-multi')?.[0]?.path).toBe('/tmp/b.jpg');
  });

  it('whenFallbackTargetAlreadyExists_downloadImageDirectlyToPropertyFolder_shouldSkipFetchAndReturnTrue', async () => {
    // Arrange
    const { service, fileName, logger } = createService();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('already.jpg');
    fileName.pathExists.mockResolvedValue(true);
    // Action
    const result = await (service as unknown as {
      downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
    }).downloadImageDirectlyToPropertyFolder('https://img/exists.jpg', '/tmp/download/123');
    // Assert
    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Image already exists. Skipping overwrite for URL: https://img/exists.jpg');
  });

  it('whenFallbackReturnsNon404BeforeSuccess_downloadImageDirectlyToPropertyFolder_shouldRetryAndThenPersistImage', async () => {
    // Arrange
    const { service, fileName } = createService();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('retry-success.jpg');
    fileName.pathExists.mockResolvedValue(false);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        arrayBuffer: async () => new ArrayBuffer(0)
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => Uint8Array.from([7, 8, 9]).buffer
      } as Response);
    // Action
    const result = await (service as unknown as {
      downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
    }).downloadImageDirectlyToPropertyFolder('https://img/retry-success.jpg', '/tmp/download/123');
    // Assert
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(300);
    expect(writeFile).toHaveBeenCalledWith('/tmp/download/123/retry-success.jpg', Buffer.from([7, 8, 9]));
  });

  it('whenFallbackGetsEmptyBodyAcrossAttempts_downloadImageDirectlyToPropertyFolder_shouldReturnFalseOnLastAttempt', async () => {
    // Arrange
    const { service, fileName, logger } = createService();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('empty-body.jpg');
    fileName.pathExists.mockResolvedValue(false);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0)
    } as Response);
    // Action
    const result = await (service as unknown as {
      downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
    }).downloadImageDirectlyToPropertyFolder('https://img/empty-body.jpg', '/tmp/download/123');
    // Assert
    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(300);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Direct-download fallback failed for "https://img/empty-body.jpg"')
    );
  });

  it('whenDirectFallbackAttemptsAreConfiguredAsZero_downloadImageDirectlyToPropertyFolder_shouldReturnFalseWithoutLoop', async () => {
    // Arrange
    const { service, fileName } = createService();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('no-loop.jpg');
    fileName.pathExists.mockResolvedValue(false);
    const originalAttempts = (ImageDownloader as unknown as { DIRECT_DOWNLOAD_MAX_ATTEMPTS: number }).DIRECT_DOWNLOAD_MAX_ATTEMPTS;
    (ImageDownloader as unknown as { DIRECT_DOWNLOAD_MAX_ATTEMPTS: number }).DIRECT_DOWNLOAD_MAX_ATTEMPTS = 0;
    let result = true;
    try {
      // Action
      result = await (service as unknown as {
        downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
      }).downloadImageDirectlyToPropertyFolder('https://img/no-loop.jpg', '/tmp/download/123');
    } finally {
      (ImageDownloader as unknown as { DIRECT_DOWNLOAD_MAX_ATTEMPTS: number }).DIRECT_DOWNLOAD_MAX_ATTEMPTS = originalAttempts;
    }
    // Assert
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
