import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'src/application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'src/application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'src/application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';
import { FinalizePropertyImagesUseCase } from 'src/application/usecases/finalize-property-images.use-case';
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

class ScraperConfigMockForFinalizePropertyImagesUseCase {
  readonly imageDownloadFolder = '/tmp/images';
}

class ImageDownloadPathServiceMock {
  readonly getIncomingFolderPath = jest.fn<(folder: string) => string>();
  readonly getDownloadFolderPath = jest.fn<(folder: string) => string>();
  readonly getLeftoversFolderPath = jest.fn<(folder: string) => string>();
}

class ImageUrlRulesServiceMock {
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
  readonly waitForPendingImageDownloads = jest.fn<(timeoutMs: number) => Promise<void>>();
  readonly waitForImageNetworkSettled = jest.fn<(logger: unknown, maxWaitMs: number, quietWindowMs: number) => Promise<void>>();
  readonly resetPendingRequests = jest.fn<() => void>();
}

class ImagePendingQueuePublisherServiceMock {
  readonly publishPendingImageUrl = jest.fn<(url: string, propertyId: string) => Promise<void>>();
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

function createUseCase() {
  const pathService = new ImageDownloadPathServiceMock();
  const urlRules = new ImageUrlRulesServiceMock();
  const fileName = new ImageFileNameServiceMock();
  const networkCapture = new ImageNetworkCaptureServiceMock();
  const pendingPublisher = new ImagePendingQueuePublisherServiceMock();
  const useCase = new FinalizePropertyImagesUseCase(
    new ScraperConfigMockForFinalizePropertyImagesUseCase() as unknown as ScraperConfig,
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
  (useCase as unknown as { logger: typeof logger }).logger = logger;
  return { useCase, pathService, urlRules, fileName, networkCapture, pendingPublisher, logger };
}

describe('FinalizePropertyImagesUseCase', () => {
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

  it('whenPropertyIdCannotBeExtracted_execute_shouldSkipProcessing', async () => {
    // Arrange
    const { useCase, urlRules, logger } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue(null);
    const property = createProperty('https://www.idealista.com/alquiler-viviendas/madrid/', []);
    // Action
    await useCase.execute(property);
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Unable to extract property id from URL: https://www.idealista.com/alquiler-viviendas/madrid/');
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('whenImageCandidateIsMissing_execute_shouldPublishPendingUrl', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, pendingPublisher, networkCapture } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('777');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-1');
    fileName.pathExists.mockResolvedValue(false);
    const moveRemainingSpy = jest.spyOn(
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/777/', [new PropertyImage('https://img/a.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(fetchMock).toHaveBeenCalledWith('https://img/a.jpg');
    expect(pendingPublisher.publishPendingImageUrl).toHaveBeenCalledWith('https://img/a.jpg', '777');
    expect(moveRemainingSpy).toHaveBeenCalledWith('/tmp/images/incoming');
    expect(networkCapture.resetPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('whenImageCandidateIsMissingAndDirectFallbackSucceeds_execute_shouldWriteDirectlyAndSkipPendingQueue', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, pendingPublisher } = createUseCase();
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
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/778/', [new PropertyImage('https://img/missing.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(fetchMock).toHaveBeenCalledWith('https://img/missing.jpg');
    expect(writeFile).toHaveBeenCalledWith('/tmp/images/download/778/fallback-778.jpg', Buffer.from([1, 2, 3]));
    expect(pendingPublisher.publishPendingImageUrl).not.toHaveBeenCalled();
  });

  it('whenImageIsNotTrackable_execute_shouldSkipImageProcessing', async () => {
    // Arrange
    const { useCase, urlRules, pathService, networkCapture } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('701');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(false);
    jest.spyOn(
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/701/', [new PropertyImage('https://img/not-allowed.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(urlRules.extractCanonicalImageKey).not.toHaveBeenCalled();
    expect(networkCapture.resetPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('whenImageKeyCannotBeExtracted_execute_shouldLogAndContinue', async () => {
    // Arrange
    const { useCase, urlRules, pathService, logger } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('702');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue(null);
    jest.spyOn(
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/702/', [new PropertyImage('https://img/no-key.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Image URL cannot be normalized to a key: https://img/no-key.jpg');
  });

  it('whenSelectedCandidateIsUndefined_execute_shouldPublishPendingUrl', async () => {
    // Arrange
    const { useCase, urlRules, pathService, pendingPublisher } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('703');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-703');
    jest.spyOn(
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    (useCase as unknown as { incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string } | undefined>> }).incomingImagesByKey
      .set('key-703', [undefined]);
    const property = createProperty('https://www.idealista.com/inmueble/703/', [new PropertyImage('https://img/undefined.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(pendingPublisher.publishPendingImageUrl).toHaveBeenCalledWith('https://img/undefined.jpg', '703');
  });

  it('whenTargetAlreadyExists_execute_shouldDeleteSourceAndSkipRename', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, networkCapture } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('888');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-2');
    fileName.buildCompatibleTargetFilename.mockReturnValue('img.jpg');
    fileName.pathExists.mockResolvedValue(true);
    const moveRemainingSpy = jest.spyOn(
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    (useCase as unknown as { incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string }>> }).incomingImagesByKey
      .set('key-2', [{ url: 'https://img/b.jpg', path: '/tmp/images/incoming/source.jpg', extension: 'jpg' }]);
    const property = createProperty('https://www.idealista.com/inmueble/888/', [new PropertyImage('https://img/b.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(rm).toHaveBeenCalledWith('/tmp/images/incoming/source.jpg', { force: true });
    expect(rename).not.toHaveBeenCalled();
    expect(moveRemainingSpy).toHaveBeenCalled();
    expect(networkCapture.resetPendingRequests).toHaveBeenCalled();
  });

  it('whenRenameFails_execute_shouldLogErrorAndContinue', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, logger } = createUseCase();
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
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    (useCase as unknown as { incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string }>> }).incomingImagesByKey
      .set('key-3', [{ url: 'https://img/c.jpg', path: '/tmp/images/incoming/source-c.jpg', extension: 'jpg' }]);
    const property = createProperty('https://www.idealista.com/inmueble/999/', [new PropertyImage('https://img/c.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Failed moving image for URL: https://img/c.jpg');
  });

  it('whenPersistCapturedImageReceivesValidBody_persistCapturedImage_shouldStoreImageAndCacheByKey', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName } = createUseCase();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    urlRules.extractCanonicalImageKey.mockReturnValue('canonical-a');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    fileName.buildImageFilename.mockReturnValue('captured.bin');
    fileName.resolveImageExtension.mockReturnValue('jpg');
    // Action
    await useCase.persistCapturedImage({
      requestId: 'req-1',
      url: 'https://img4.idealista.com/blur/a.jpg',
      mimeType: 'image/jpeg',
      body: { body: Buffer.from('abc').toString('base64'), base64Encoded: true }
    });
    // Assert
    expect(writeFile).toHaveBeenCalledWith('/tmp/images/incoming/captured.bin', expect.any(Buffer));
    const cache = (useCase as unknown as { incomingImagesByKey: Map<string, Array<{ path: string }>> }).incomingImagesByKey;
    expect(cache.get('canonical-a')?.[0]?.path).toBe('/tmp/images/incoming/captured.bin');
  });

  it('whenPersistCapturedImageReceivesBinaryBody_persistCapturedImage_shouldDecodeUsingBinaryCodec', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName } = createUseCase();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    urlRules.extractCanonicalImageKey.mockReturnValue('canonical-binary');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    fileName.buildImageFilename.mockReturnValue('captured-binary.bin');
    fileName.resolveImageExtension.mockReturnValue('jpg');
    // Action
    await useCase.persistCapturedImage({
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
    const { useCase, urlRules } = createUseCase();
    urlRules.shouldTrackImageUrl.mockReturnValue(false);
    // Action
    await useCase.persistCapturedImage({
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
    const { useCase, urlRules } = createUseCase();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    // Action
    await useCase.persistCapturedImage({
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
    const { useCase, urlRules, pathService, fileName } = createUseCase();
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.isSvgImage.mockReturnValue(false);
    urlRules.extractCanonicalImageKey.mockReturnValue(null);
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    fileName.buildImageFilename.mockReturnValue('no-key.bin');
    // Action
    await useCase.persistCapturedImage({
      requestId: 'req-4',
      url: 'https://img4.idealista.com/blur/d.jpg',
      mimeType: 'image/jpeg',
      body: { body: Buffer.from('abc').toString('base64'), base64Encoded: true }
    });
    // Assert
    expect(writeFile).toHaveBeenCalledWith('/tmp/images/incoming/no-key.bin', expect.any(Buffer));
    const cache = (useCase as unknown as { incomingImagesByKey: Map<string, unknown> }).incomingImagesByKey;
    expect(cache.size).toBe(0);
  });

  it('whenIncomingEntriesContainFilesAndDirectories_moveRemainingIncomingToLeftovers_shouldMoveAndCleanEntries', async () => {
    // Arrange
    const { useCase, pathService } = createUseCase();
    pathService.getLeftoversFolderPath.mockReturnValue('/tmp/images/leftovers');
    (readdir as unknown as jest.Mock).mockImplementationOnce(async () => [
      { name: 'a.jpg', isFile: () => true, isDirectory: () => false },
      { name: 'folder-a', isFile: () => false, isDirectory: () => true }
    ]);
    // Action
    await (useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingFolderPath: string) => Promise<void> })
      .moveRemainingIncomingToLeftovers('/tmp/images/incoming');
    // Assert
    expect(mkdir).toHaveBeenCalledWith('/tmp/images/leftovers', { recursive: true });
    expect(rm).toHaveBeenCalledWith('/tmp/images/leftovers/a.jpg', { force: true });
    expect(rename).toHaveBeenCalledWith('/tmp/images/incoming/a.jpg', '/tmp/images/leftovers/a.jpg');
    expect(rm).toHaveBeenCalledWith('/tmp/images/incoming/folder-a', { recursive: true, force: true });
  });

  it('whenIncomingEntryIsNeitherFileNorDirectory_moveRemainingIncomingToLeftovers_shouldIgnoreUnknownEntryType', async () => {
    // Arrange
    const { useCase, pathService } = createUseCase();
    pathService.getLeftoversFolderPath.mockReturnValue('/tmp/images/leftovers');
    (readdir as unknown as jest.Mock).mockImplementationOnce(async () => [
      { name: 'socket-a', isFile: () => false, isDirectory: () => false }
    ]);
    // Action
    await (useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingFolderPath: string) => Promise<void> })
      .moveRemainingIncomingToLeftovers('/tmp/images/incoming');
    // Assert
    expect(mkdir).toHaveBeenCalledWith('/tmp/images/leftovers', { recursive: true });
    expect(rename).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalledWith('/tmp/images/incoming/socket-a', { recursive: true, force: true });
  });

  it('whenMultipleCandidatesExist_consumeIncomingImageByKey_shouldKeepRemainingCandidatesMapped', () => {
    // Arrange
    const { useCase } = createUseCase();
    const map = (useCase as unknown as {
      incomingImagesByKey: Map<string, Array<{ url: string; path: string; extension: string }>>;
    }).incomingImagesByKey;
    map.set('canonical-multi', [
      { url: 'https://img/a.jpg', path: '/tmp/a.jpg', extension: 'jpg' },
      { url: 'https://img/b.jpg', path: '/tmp/b.jpg', extension: 'jpg' }
    ]);
    // Action
    const selected = (useCase as unknown as {
      consumeIncomingImageByKey: (key: string) => { url: string; path: string; extension: string } | undefined;
    }).consumeIncomingImageByKey('canonical-multi');
    // Assert
    expect(selected?.path).toBe('/tmp/a.jpg');
    expect(map.get('canonical-multi')?.length).toBe(1);
    expect(map.get('canonical-multi')?.[0]?.path).toBe('/tmp/b.jpg');
  });

  it('whenNoTimeoutIsProvided_waitForPendingImageDownloads_shouldUseDefaultTimeout', async () => {
    // Arrange
    const { useCase, networkCapture } = createUseCase();
    // Action
    await (useCase as unknown as {
      waitForPendingImageDownloads: (timeoutMs?: number) => Promise<void>;
    }).waitForPendingImageDownloads();
    // Assert
    expect(networkCapture.waitForPendingImageDownloads).toHaveBeenCalledWith(15000);
  });

  it('whenNoWindowArgumentsAreProvided_waitForImageNetworkSettled_shouldUseDefaultValues', async () => {
    // Arrange
    const { useCase, networkCapture, logger } = createUseCase();
    // Action
    await (useCase as unknown as {
      waitForImageNetworkSettled: (maxWaitMs?: number, quietWindowMs?: number) => Promise<void>;
    }).waitForImageNetworkSettled();
    // Assert
    expect(networkCapture.waitForImageNetworkSettled).toHaveBeenCalledWith(logger, 12000, 1200);
  });

  it('whenFallbackTargetAlreadyExists_downloadImageDirectlyToPropertyFolder_shouldSkipFetchAndReturnTrue', async () => {
    // Arrange
    const { useCase, fileName, logger } = createUseCase();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('already.jpg');
    fileName.pathExists.mockResolvedValue(true);
    // Action
    const result = await (useCase as unknown as {
      downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
    }).downloadImageDirectlyToPropertyFolder('https://img/exists.jpg', '/tmp/download/123');
    // Assert
    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Image already exists. Skipping overwrite for URL: https://img/exists.jpg');
  });

  it('whenFallbackReturnsNon404BeforeSuccess_downloadImageDirectlyToPropertyFolder_shouldRetryAndThenPersistImage', async () => {
    // Arrange
    const { useCase, fileName } = createUseCase();
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
    const result = await (useCase as unknown as {
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
    const { useCase, fileName, logger } = createUseCase();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('empty-body.jpg');
    fileName.pathExists.mockResolvedValue(false);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0)
    } as Response);
    // Action
    const result = await (useCase as unknown as {
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
    const { useCase, fileName } = createUseCase();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('no-loop.jpg');
    fileName.pathExists.mockResolvedValue(false);
    const originalAttempts = (FinalizePropertyImagesUseCase as unknown as { DIRECT_DOWNLOAD_MAX_ATTEMPTS: number }).DIRECT_DOWNLOAD_MAX_ATTEMPTS;
    (FinalizePropertyImagesUseCase as unknown as { DIRECT_DOWNLOAD_MAX_ATTEMPTS: number }).DIRECT_DOWNLOAD_MAX_ATTEMPTS = 0;
    let result = true;
    try {
      // Action
      result = await (useCase as unknown as {
        downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
      }).downloadImageDirectlyToPropertyFolder('https://img/no-loop.jpg', '/tmp/download/123');
    } finally {
      (FinalizePropertyImagesUseCase as unknown as { DIRECT_DOWNLOAD_MAX_ATTEMPTS: number }).DIRECT_DOWNLOAD_MAX_ATTEMPTS = originalAttempts;
    }
    // Assert
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
