import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ImageDownloadPathService } from 'application/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';
import { FinalizePropertyImagesUseCase } from 'application/usecases/imagedownload/finalize-property-images.use-case';
import { Property } from 'domain/property/property.model';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group.model';
import { PropertyImage } from 'domain/property/property-image.model';
import { PropertyMainFeatures } from 'domain/property/property-main-features.model';
import type { FileSystemPort } from 'ports/outbound/filesystem/file-system.port';
import type { HttpBinaryDownloadPort } from 'ports/outbound/network/http-binary-download.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';

class ScraperConfigMockForFinalizePropertyImagesUseCase {
  readonly imageDownloadFolder = '/tmp/images';
}

class ImageDownloadPathServiceMock {
  readonly getIncomingFolderPath = jest.fn<(folder: string) => string>();
  readonly getDownloadFolderPath = jest.fn<(folder: string) => string>();
  readonly getLeftoversFolderPath = jest.fn<(folder: string) => string>();
  readonly getPropertyFolderPath = jest.fn<(folder: string, propertyId: string) => string>();
  readonly joinPath = jest.fn((...segments: string[]) => segments.join('/'));
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

class FileSystemPortMock implements FileSystemPort {
  readonly ensureDirectory = jest.fn<(path: string) => Promise<void>>();
  readonly listEntries = jest.fn<(path: string) => Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>>>();
  readonly move = jest.fn<(sourcePath: string, targetPath: string) => Promise<void>>();
  readonly deleteFile = jest.fn<(path: string) => Promise<void>>();
  readonly deleteDirectory = jest.fn<(path: string) => Promise<void>>();
  readonly writeFile = jest.fn<(path: string, bytes: Buffer) => Promise<void>>();
}

class HttpBinaryDownloadPortMock implements HttpBinaryDownloadPort {
  readonly download = jest.fn<(url: string) => Promise<{ ok: boolean; status: number; bytes: Buffer }>>();
}

class SleepPortMock implements SleepPort {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class ErrorMessagePortMock implements ErrorMessagePort {
  readonly toErrorMessage = jest.fn<(error: unknown) => string>();
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
  const fileSystem = new FileSystemPortMock();
  const httpBinaryDownloadPort = new HttpBinaryDownloadPortMock();
  const errorMessagePort = new ErrorMessagePortMock();
  const sleepPort = new SleepPortMock();
  const useCase = new FinalizePropertyImagesUseCase(
    new ScraperConfigMockForFinalizePropertyImagesUseCase() as unknown as ScraperSettingsPort,
    pathService as unknown as ImageDownloadPathService,
    urlRules as unknown as ImageUrlRulesService,
    fileName as unknown as ImageFileNameService,
    networkCapture as unknown as ImageNetworkCaptureService,
    pendingPublisher as unknown as ImagePendingQueuePublisherService,
    fileSystem,
    httpBinaryDownloadPort,
    errorMessagePort,
    sleepPort
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
  pathService.getPropertyFolderPath.mockImplementation((folder: string, propertyId: string) => `${folder}/download/${propertyId}`);
  fileName.pathExists.mockResolvedValue(false);
  fileSystem.ensureDirectory.mockResolvedValue(undefined);
  fileSystem.listEntries.mockResolvedValue([]);
  fileSystem.move.mockResolvedValue(undefined);
  fileSystem.deleteFile.mockResolvedValue(undefined);
  fileSystem.deleteDirectory.mockResolvedValue(undefined);
  fileSystem.writeFile.mockResolvedValue(undefined);
  httpBinaryDownloadPort.download.mockResolvedValue({ ok: false, status: 404, bytes: Buffer.alloc(0) });
  errorMessagePort.toErrorMessage.mockImplementation((error: unknown) =>
    error instanceof Error ? error.message : String(error)
  );
  sleepPort.sleep.mockResolvedValue(undefined);
  (useCase as unknown as { logger: typeof logger }).logger = logger;
  return {
    useCase,
    pathService,
    urlRules,
    fileName,
    networkCapture,
    pendingPublisher,
    fileSystem,
    httpBinaryDownloadPort,
    errorMessagePort,
    sleepPort,
    logger
  };
}

describe('FinalizePropertyImagesUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenPropertyIdCannotBeExtracted_execute_shouldSkipProcessing', async () => {
    // Arrange
    const { useCase, urlRules, fileSystem, logger } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue(null);
    const property = createProperty('https://www.idealista.com/alquiler-viviendas/madrid/', []);
    // Action
    await useCase.execute(property);
    // Assert
    expect(logger.error).toHaveBeenCalledWith('Unable to extract property id from URL: https://www.idealista.com/alquiler-viviendas/madrid/');
    expect(fileSystem.ensureDirectory).not.toHaveBeenCalled();
  });

  it('whenImageCandidateIsMissing_execute_shouldPublishPendingUrl', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, pendingPublisher, networkCapture, httpBinaryDownloadPort } = createUseCase();
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
    expect(httpBinaryDownloadPort.download).toHaveBeenCalledWith('https://img/a.jpg');
    expect(pendingPublisher.publishPendingImageUrl).toHaveBeenCalledWith('https://img/a.jpg', '777');
    expect(moveRemainingSpy).toHaveBeenCalledWith('/tmp/images/incoming');
    expect(networkCapture.resetPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('whenImageCandidateIsMissingAndDirectFallbackSucceeds_execute_shouldWriteDirectlyAndSkipPendingQueue', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, fileSystem, pendingPublisher, httpBinaryDownloadPort } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('778');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-778');
    fileName.buildCompatibleTargetFilename.mockReturnValue('fallback-778.jpg');
    httpBinaryDownloadPort.download.mockResolvedValue({
      ok: true,
      status: 200,
      bytes: Buffer.from([1, 2, 3])
    });
    jest.spyOn(
      useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingPath: string) => Promise<void> },
      'moveRemainingIncomingToLeftovers'
    ).mockResolvedValue(undefined);
    const property = createProperty('https://www.idealista.com/inmueble/778/', [new PropertyImage('https://img/missing.jpg', null)]);
    // Action
    await useCase.execute(property);
    // Assert
    expect(httpBinaryDownloadPort.download).toHaveBeenCalledWith('https://img/missing.jpg');
    expect(fileSystem.writeFile).toHaveBeenCalledWith('/tmp/images/download/778/fallback-778.jpg', Buffer.from([1, 2, 3]));
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
    const { useCase, urlRules, pathService, fileName, fileSystem, networkCapture } = createUseCase();
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
    expect(fileSystem.deleteFile).toHaveBeenCalledWith('/tmp/images/incoming/source.jpg');
    expect(fileSystem.move).not.toHaveBeenCalled();
    expect(moveRemainingSpy).toHaveBeenCalled();
    expect(networkCapture.resetPendingRequests).toHaveBeenCalled();
  });

  it('whenRenameFails_execute_shouldLogErrorAndContinue', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, fileSystem, logger } = createUseCase();
    urlRules.extractPropertyIdFromUrl.mockReturnValue('999');
    pathService.getIncomingFolderPath.mockReturnValue('/tmp/images/incoming');
    pathService.getDownloadFolderPath.mockReturnValue('/tmp/images/download');
    urlRules.shouldTrackImageUrl.mockReturnValue(true);
    urlRules.extractCanonicalImageKey.mockReturnValue('key-3');
    fileName.buildCompatibleTargetFilename.mockReturnValue('img.jpg');
    fileName.pathExists.mockResolvedValue(false);
    fileSystem.move.mockImplementationOnce(async () => {
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
    const { useCase, urlRules, pathService, fileName, fileSystem } = createUseCase();
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
    expect(fileSystem.writeFile).toHaveBeenCalledWith('/tmp/images/incoming/captured.bin', expect.any(Buffer));
    const cache = (useCase as unknown as { incomingImagesByKey: Map<string, Array<{ path: string }>> }).incomingImagesByKey;
    expect(cache.get('canonical-a')?.[0]?.path).toBe('/tmp/images/incoming/captured.bin');
  });

  it('whenPersistCapturedImageReceivesBinaryBody_persistCapturedImage_shouldDecodeUsingBinaryCodec', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, fileSystem } = createUseCase();
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
    expect(fileSystem.writeFile).toHaveBeenCalledWith('/tmp/images/incoming/captured-binary.bin', Buffer.from('abc', 'binary'));
  });

  it('whenPersistCapturedImageIsUntrackable_persistCapturedImage_shouldSkipDiskWrite', async () => {
    // Arrange
    const { useCase, fileSystem, urlRules } = createUseCase();
    urlRules.shouldTrackImageUrl.mockReturnValue(false);
    // Action
    await useCase.persistCapturedImage({
      requestId: 'req-2',
      url: 'https://img4.idealista.com/blur/b.jpg',
      mimeType: 'image/jpeg',
      body: { body: '', base64Encoded: false }
    });
    // Assert
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it('whenPersistCapturedImageHasNoBytes_persistCapturedImage_shouldSkipDiskWrite', async () => {
    // Arrange
    const { useCase, fileSystem, urlRules } = createUseCase();
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
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it('whenPersistCapturedImageHasNoCanonicalKey_persistCapturedImage_shouldWriteFileWithoutCaching', async () => {
    // Arrange
    const { useCase, urlRules, pathService, fileName, fileSystem } = createUseCase();
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
    expect(fileSystem.writeFile).toHaveBeenCalledWith('/tmp/images/incoming/no-key.bin', expect.any(Buffer));
    const cache = (useCase as unknown as { incomingImagesByKey: Map<string, unknown> }).incomingImagesByKey;
    expect(cache.size).toBe(0);
  });

  it('whenIncomingEntriesContainFilesAndDirectories_moveRemainingIncomingToLeftovers_shouldMoveAndCleanEntries', async () => {
    // Arrange
    const { useCase, fileSystem, pathService } = createUseCase();
    pathService.getLeftoversFolderPath.mockReturnValue('/tmp/images/leftovers');
    fileSystem.listEntries.mockResolvedValueOnce([
      { name: 'a.jpg', isFile: true, isDirectory: false },
      { name: 'folder-a', isFile: false, isDirectory: true }
    ]);
    // Action
    await (useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingFolderPath: string) => Promise<void> })
      .moveRemainingIncomingToLeftovers('/tmp/images/incoming');
    // Assert
    expect(fileSystem.ensureDirectory).toHaveBeenCalledWith('/tmp/images/leftovers');
    expect(fileSystem.deleteFile).toHaveBeenCalledWith('/tmp/images/leftovers/a.jpg');
    expect(fileSystem.move).toHaveBeenCalledWith('/tmp/images/incoming/a.jpg', '/tmp/images/leftovers/a.jpg');
    expect(fileSystem.deleteDirectory).toHaveBeenCalledWith('/tmp/images/incoming/folder-a');
  });

  it('whenIncomingEntryIsNeitherFileNorDirectory_moveRemainingIncomingToLeftovers_shouldIgnoreUnknownEntryType', async () => {
    // Arrange
    const { useCase, fileSystem, pathService } = createUseCase();
    pathService.getLeftoversFolderPath.mockReturnValue('/tmp/images/leftovers');
    fileSystem.listEntries.mockResolvedValueOnce([
      { name: 'socket-a', isFile: false, isDirectory: false }
    ]);
    // Action
    await (useCase as unknown as { moveRemainingIncomingToLeftovers: (incomingFolderPath: string) => Promise<void> })
      .moveRemainingIncomingToLeftovers('/tmp/images/incoming');
    // Assert
    expect(fileSystem.ensureDirectory).toHaveBeenCalledWith('/tmp/images/leftovers');
    expect(fileSystem.move).not.toHaveBeenCalled();
    expect(fileSystem.deleteDirectory).not.toHaveBeenCalledWith('/tmp/images/incoming/socket-a');
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
    const { useCase, fileName, logger, httpBinaryDownloadPort } = createUseCase();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('already.jpg');
    fileName.pathExists.mockResolvedValue(true);
    // Action
    const result = await (useCase as unknown as {
      downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
    }).downloadImageDirectlyToPropertyFolder('https://img/exists.jpg', '/tmp/download/123');
    // Assert
    expect(result).toBe(true);
    expect(httpBinaryDownloadPort.download).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Image already exists. Skipping overwrite for URL: https://img/exists.jpg');
  });

  it('whenFallbackReturnsNon404BeforeSuccess_downloadImageDirectlyToPropertyFolder_shouldRetryAndThenPersistImage', async () => {
    // Arrange
    const { useCase, fileName, fileSystem, sleepPort, httpBinaryDownloadPort } = createUseCase();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('retry-success.jpg');
    fileName.pathExists.mockResolvedValue(false);
    httpBinaryDownloadPort.download
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        bytes: Buffer.alloc(0)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        bytes: Buffer.from([7, 8, 9])
      });
    // Action
    const result = await (useCase as unknown as {
      downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
    }).downloadImageDirectlyToPropertyFolder('https://img/retry-success.jpg', '/tmp/download/123');
    // Assert
    expect(result).toBe(true);
    expect(httpBinaryDownloadPort.download).toHaveBeenCalledTimes(2);
    expect(sleepPort.sleep).toHaveBeenCalledWith(300);
    expect(fileSystem.writeFile).toHaveBeenCalledWith('/tmp/download/123/retry-success.jpg', Buffer.from([7, 8, 9]));
  });

  it('whenFallbackGetsEmptyBodyAcrossAttempts_downloadImageDirectlyToPropertyFolder_shouldReturnFalseOnLastAttempt', async () => {
    // Arrange
    const { useCase, fileName, logger, sleepPort, httpBinaryDownloadPort } = createUseCase();
    fileName.resolveImageExtension.mockReturnValue('.jpg');
    fileName.buildCompatibleTargetFilename.mockReturnValue('empty-body.jpg');
    fileName.pathExists.mockResolvedValue(false);
    httpBinaryDownloadPort.download.mockResolvedValue({
      ok: true,
      status: 200,
      bytes: Buffer.alloc(0)
    });
    // Action
    const result = await (useCase as unknown as {
      downloadImageDirectlyToPropertyFolder: (imageUrl: string, propertyFolderPath: string) => Promise<boolean>;
    }).downloadImageDirectlyToPropertyFolder('https://img/empty-body.jpg', '/tmp/download/123');
    // Assert
    expect(result).toBe(false);
    expect(httpBinaryDownloadPort.download).toHaveBeenCalledTimes(3);
    expect(sleepPort.sleep).toHaveBeenCalledWith(300);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Direct-download fallback failed for "https://img/empty-body.jpg"')
    );
  });

  it('whenDirectFallbackAttemptsAreConfiguredAsZero_downloadImageDirectlyToPropertyFolder_shouldReturnFalseWithoutLoop', async () => {
    // Arrange
    const { useCase, fileName, httpBinaryDownloadPort } = createUseCase();
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
    expect(httpBinaryDownloadPort.download).not.toHaveBeenCalled();
  });
});
