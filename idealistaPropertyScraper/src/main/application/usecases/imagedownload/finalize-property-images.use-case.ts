import { Inject, Injectable, Logger } from '@nestjs/common';
import { ImageDownloadPathService } from 'application/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';
import { Property } from 'domain/property/property';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';
import { FILE_SYSTEM_PORT } from 'ports/outbound/filesystem/file-system.port.token';
import { HTTP_BINARY_DOWNLOAD_PORT } from 'ports/outbound/network/http-binary-download.port.token';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { DownloadedIncomingImage } from 'application/dto/imagedownload/downloaded-incoming-image.dto';
import type { ImageResponseBodyPayload } from 'application/dto/imagedownload/image-response-body-payload.dto';
import type { FileSystemPort } from 'ports/outbound/filesystem/file-system.port';
import type { HttpBinaryDownloadPort } from 'ports/outbound/network/http-binary-download.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';

@Injectable()
export class FinalizePropertyImagesUseCase {
  private readonly logger = new Logger(FinalizePropertyImagesUseCase.name);
  private readonly incomingImagesByKey = new Map<string, DownloadedIncomingImage[]>();
  private static readonly MISSING_IMAGE_RECOVERY_WAIT_MS = 4000;
  private static readonly DIRECT_DOWNLOAD_MAX_ATTEMPTS = 3;
  private static readonly DIRECT_DOWNLOAD_RETRY_WAIT_MS = 300;

  constructor(
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort,
    private readonly imageDownloadPathService: ImageDownloadPathService,
    private readonly imageUrlRulesService: ImageUrlRulesService,
    private readonly imageFileNameService: ImageFileNameService,
    private readonly imageNetworkCaptureService: ImageNetworkCaptureService,
    private readonly imagePendingQueuePublisherService: ImagePendingQueuePublisherService,
    @Inject(FILE_SYSTEM_PORT) private readonly fileSystemPort: FileSystemPort,
    @Inject(HTTP_BINARY_DOWNLOAD_PORT)
    private readonly httpBinaryDownloadPort: HttpBinaryDownloadPort,
    @Inject(ERROR_MESSAGE_PORT) private readonly errorMessagePort: ErrorMessagePort,
    @Inject(SLEEP_PORT) private readonly sleepPort: SleepPort
  ) {}

  async execute(property: Property): Promise<void> {
    const propertyId = this.imageUrlRulesService.extractPropertyIdFromUrl(property.url);
    if (!propertyId) {
      this.logger.error(`Unable to extract property id from URL: ${property.url}`);
      return;
    }

    const incomingFolderPath = this.imageDownloadPathService.getIncomingFolderPath(this.scraperConfig.imageDownloadFolder);
    const propertyFolderPath = this.imageDownloadPathService.getPropertyFolderPath(this.scraperConfig.imageDownloadFolder, propertyId);
    await this.fileSystemPort.ensureDirectory(propertyFolderPath);
    let recoverySyncPerformed = false;

    for (const image of property.images) {
      if (!this.imageUrlRulesService.shouldTrackImageUrl(image.url)) {
        continue;
      }

      const key = this.imageUrlRulesService.extractCanonicalImageKey(image.url);
      if (!key) {
        this.logger.error(`Image URL cannot be normalized to a key: ${image.url}`);
        continue;
      }

      let selectedFile = this.consumeIncomingImageByKey(key);
      if (!selectedFile && !recoverySyncPerformed) {
        recoverySyncPerformed = true;
        await this.waitForPendingImageDownloads(FinalizePropertyImagesUseCase.MISSING_IMAGE_RECOVERY_WAIT_MS);
        await this.waitForImageNetworkSettled(FinalizePropertyImagesUseCase.MISSING_IMAGE_RECOVERY_WAIT_MS, 1000);
        selectedFile = this.consumeIncomingImageByKey(key);
      }

      if (!selectedFile) {
        const fallbackStored = await this.downloadImageDirectlyToPropertyFolder(image.url, propertyFolderPath);
        if (!fallbackStored) {
          this.logger.error(`Image URL was not downloaded and cannot be moved: ${image.url}`);
          await this.imagePendingQueuePublisherService.publishPendingImageUrl(image.url, propertyId);
        }
        continue;
      }

      const sourcePath = selectedFile.path;
      const targetFilename = this.imageFileNameService.buildCompatibleTargetFilename(image.url, selectedFile.extension);
      const targetPath = this.imageDownloadPathService.joinPath(propertyFolderPath, targetFilename);

      try {
        if (await this.imageFileNameService.pathExists(targetPath)) {
          this.logger.log(`Image already exists. Skipping overwrite for URL: ${image.url}`);
          await this.fileSystemPort.deleteFile(sourcePath);
          continue;
        }

        await this.fileSystemPort.move(sourcePath, targetPath);
      } catch {
        this.logger.error(`Failed moving image for URL: ${image.url}`);
      }
    }

    await this.moveRemainingIncomingToLeftovers(incomingFolderPath);
    this.incomingImagesByKey.clear();
    this.imageNetworkCaptureService.resetPendingRequests();
  }

  async persistCapturedImage(payload: ImageResponseBodyPayload): Promise<void> {
    const { url, mimeType, body } = payload;
    if (!this.imageUrlRulesService.shouldTrackImageUrl(url) || this.imageUrlRulesService.isSvgImage(url, mimeType)) {
      return;
    }

    const bytes = body.base64Encoded
      ? Buffer.from(body.body, 'base64')
      : Buffer.from(body.body, 'binary');
    if (bytes.length === 0) {
      return;
    }

    const incomingFolderPath = this.imageDownloadPathService.getIncomingFolderPath(this.scraperConfig.imageDownloadFolder);
    const filename = this.imageFileNameService.buildImageFilename(url, mimeType);
    const filepath = this.imageDownloadPathService.joinPath(incomingFolderPath, filename);
    await this.fileSystemPort.writeFile(filepath, bytes);

    const key = this.imageUrlRulesService.extractCanonicalImageKey(url);
    if (!key) {
      return;
    }

    const extension = this.imageFileNameService.resolveImageExtension(url, mimeType);
    const list = this.incomingImagesByKey.get(key) ?? [];
    list.push({
      url,
      path: filepath,
      extension
    });
    this.incomingImagesByKey.set(key, list);
  }

  private async waitForPendingImageDownloads(timeoutMs = 15000): Promise<void> {
    await this.imageNetworkCaptureService.waitForPendingImageDownloads(timeoutMs);
  }

  private async waitForImageNetworkSettled(maxWaitMs = 12000, quietWindowMs = 1200): Promise<void> {
    await this.imageNetworkCaptureService.waitForImageNetworkSettled(this.logger, maxWaitMs, quietWindowMs);
  }

  private consumeIncomingImageByKey(key: string): DownloadedIncomingImage | undefined {
    const candidates = this.incomingImagesByKey.get(key);
    if (!candidates || candidates.length === 0) {
      return undefined;
    }

    const selected = candidates.shift();
    if (candidates.length === 0) {
      this.incomingImagesByKey.delete(key);
    } else {
      this.incomingImagesByKey.set(key, candidates);
    }

    return selected;
  }

  private async downloadImageDirectlyToPropertyFolder(
    imageUrl: string,
    propertyFolderPath: string
  ): Promise<boolean> {
    const resolvedExtension = this.imageFileNameService.resolveImageExtension(imageUrl, '');
    const targetFilename = this.imageFileNameService.buildCompatibleTargetFilename(
      imageUrl,
      resolvedExtension
    );
    const targetPath = this.imageDownloadPathService.joinPath(propertyFolderPath, targetFilename);

    if (await this.imageFileNameService.pathExists(targetPath)) {
      this.logger.log(`Image already exists. Skipping overwrite for URL: ${imageUrl}`);
      return true;
    }

    for (let attempt = 1; attempt <= FinalizePropertyImagesUseCase.DIRECT_DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        const download = await this.httpBinaryDownloadPort.download(imageUrl);
        if (!download.ok) {
          if (download.status === 404) {
            return false;
          }
          throw new Error(`HTTP ${download.status}`);
        }

        const bytes = download.bytes;
        if (bytes.length === 0) {
          throw new Error('Empty image body');
        }

        await this.fileSystemPort.writeFile(targetPath, bytes);
        this.logger.warn(`Image captured via direct-download fallback for URL: ${imageUrl}`);
        return true;
      } catch (error) {
        const isLastAttempt = attempt === FinalizePropertyImagesUseCase.DIRECT_DOWNLOAD_MAX_ATTEMPTS;
        if (isLastAttempt) {
          this.logger.warn(
            `Direct-download fallback failed for "${imageUrl}": ${this.errorMessagePort.toErrorMessage(error)}`
          );
          return false;
        }
        await this.sleepPort.sleep(FinalizePropertyImagesUseCase.DIRECT_DOWNLOAD_RETRY_WAIT_MS);
      }
    }

    return false;
  }

  private async moveRemainingIncomingToLeftovers(incomingFolderPath: string): Promise<void> {
    const leftoversFolderPath = this.imageDownloadPathService.getLeftoversFolderPath(this.scraperConfig.imageDownloadFolder);
    await this.fileSystemPort.ensureDirectory(leftoversFolderPath);
    const entries = await this.fileSystemPort.listEntries(incomingFolderPath);

    for (const entry of entries) {
      const entryPath = this.imageDownloadPathService.joinPath(incomingFolderPath, entry.name);
      if (entry.isFile) {
        const targetPath = this.imageDownloadPathService.joinPath(leftoversFolderPath, entry.name);
        await this.fileSystemPort.deleteFile(targetPath);
        await this.fileSystemPort.move(entryPath, targetPath);
        continue;
      }

      if (entry.isDirectory) {
        await this.fileSystemPort.deleteDirectory(entryPath);
      }
    }
  }
}
