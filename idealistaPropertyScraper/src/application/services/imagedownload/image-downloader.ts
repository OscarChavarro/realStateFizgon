import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Property } from 'src/domain/property/property.model';
import { DownloadedIncomingImage } from 'src/application/services/imagedownload/downloaded-incoming-image.type';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'src/application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'src/application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'src/application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageResponseBodyPayload } from 'src/application/services/imagedownload/image-response-body-payload.type';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';
import { NetworkEnabledCdpClient } from 'src/application/services/imagedownload/network-enabled-cdp-client.type';
import { NetworkLoadingFailedEvent } from 'src/application/services/imagedownload/network-loading-failed-event.type';
import { NetworkLoadingFinishedEvent } from 'src/application/services/imagedownload/network-loading-finished-event.type';
import { NetworkResponseReceivedEvent } from 'src/application/services/imagedownload/network-response-received-event.type';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { toErrorMessage } from 'src/infrastructure/error-message';
import { sleep } from 'src/infrastructure/sleep';

@Injectable()
export class ImageDownloader {
  private readonly logger = new Logger(ImageDownloader.name);
  private readonly incomingImagesByKey = new Map<string, DownloadedIncomingImage[]>();

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly scraperConfig: ScraperConfig,
    private readonly imageDownloadPathService: ImageDownloadPathService,
    private readonly imageUrlRulesService: ImageUrlRulesService,
    private readonly imageFileNameService: ImageFileNameService,
    private readonly imageNetworkCaptureService: ImageNetworkCaptureService,
    private readonly imagePendingQueuePublisherService: ImagePendingQueuePublisherService
  ) {}

  async validateImageDownloadFolder(): Promise<void> {
    const configuredFolder = this.scraperConfig.imageDownloadFolder;
    const waitMs = this.chromeConfig.chromeBrowserLaunchRetryWaitMs;
    const waitSeconds = Math.floor(waitMs / 1000);

    while (true) {
      try {
        this.imageDownloadPathService.ensureWritableFolders(configuredFolder);
        return;
      } catch (error) {
        const message = toErrorMessage(error);
        this.logger.error(`Image download folder validation failed: ${message}`);
        this.logger.error(`Check permissions, free disk space, and path configured in environment.json: "${configuredFolder}".`);
        this.logger.error(
          `NFS/shared-folder access is failing. Keeping pod alive for ${waitSeconds} seconds before retrying validation.`
        );
        await sleep(waitMs);
      }
    }
  }

  async initializeNetworkCapture(client: NetworkEnabledCdpClient): Promise<void> {
    if (this.imageNetworkCaptureService.isInitialized(client)) {
      return;
    }

    await client.Network.enable();
    this.imageNetworkCaptureService.markInitialized(client);

    client.Network.responseReceived((event) => {
      this.imageNetworkCaptureService.trackResponseReceived(
        event as NetworkResponseReceivedEvent,
        (url) => this.imageUrlRulesService.isIdealistaDomain(url)
      );
    });

    client.Network.loadingFinished((event) => {
      this.imageNetworkCaptureService.trackLoadingFinished(
        client.Network,
        event as NetworkLoadingFinishedEvent,
        async (payload) => this.persistCapturedImage(payload),
        this.logger
      );
    });

    client.Network.loadingFailed((event) => {
      this.imageNetworkCaptureService.trackLoadingFailed(event as NetworkLoadingFailedEvent);
    });
  }

  async waitForPendingImageDownloads(timeoutMs = 15000): Promise<void> {
    await this.imageNetworkCaptureService.waitForPendingImageDownloads(timeoutMs);
  }

  async waitForImageNetworkSettled(maxWaitMs = 12000, quietWindowMs = 1200): Promise<void> {
    await this.imageNetworkCaptureService.waitForImageNetworkSettled(this.logger, maxWaitMs, quietWindowMs);
  }

  async movePropertyImagesFromIncoming(property: Property): Promise<void> {
    const propertyId = this.imageUrlRulesService.extractPropertyIdFromUrl(property.url);
    if (!propertyId) {
      this.logger.error(`Unable to extract property id from URL: ${property.url}`);
      return;
    }

    const incomingFolderPath = this.imageDownloadPathService.getIncomingFolderPath(this.scraperConfig.imageDownloadFolder);
    const propertyFolderPath = join(this.imageDownloadPathService.getDownloadFolderPath(this.scraperConfig.imageDownloadFolder), propertyId);
    await mkdir(propertyFolderPath, { recursive: true });

    for (const image of property.images) {
      if (!this.imageUrlRulesService.shouldTrackImageUrl(image.url)) {
        continue;
      }

      const key = this.imageUrlRulesService.extractCanonicalImageKey(image.url);
      if (!key) {
        this.logger.error(`Image URL cannot be normalized to a key: ${image.url}`);
        continue;
      }

      const candidates = this.incomingImagesByKey.get(key);

      if (!candidates || candidates.length === 0) {
        this.logger.error(`Image URL was not downloaded and cannot be moved: ${image.url}`);
        await this.imagePendingQueuePublisherService.publishPendingImageUrl(image.url, propertyId);
        continue;
      }

      const selectedFile = candidates.shift();
      if (!selectedFile) {
        this.logger.error(`Image URL was not downloaded and cannot be moved: ${image.url}`);
        await this.imagePendingQueuePublisherService.publishPendingImageUrl(image.url, propertyId);
        continue;
      }

      const sourcePath = selectedFile.path;
      const targetFilename = this.imageFileNameService.buildCompatibleTargetFilename(image.url, selectedFile.extension);
      const targetPath = join(propertyFolderPath, targetFilename);

      try {
        if (await this.imageFileNameService.pathExists(targetPath)) {
          this.logger.log(`Image already exists. Skipping overwrite for URL: ${image.url}`);
          await rm(sourcePath, { force: true });
          continue;
        }

        await rename(sourcePath, targetPath);
      } catch {
        this.logger.error(`Failed moving image for URL: ${image.url}`);
      }
    }

    await this.moveRemainingIncomingToLeftovers(incomingFolderPath);
    this.incomingImagesByKey.clear();
    this.imageNetworkCaptureService.resetPendingRequests();
  }

  private async persistCapturedImage(payload: ImageResponseBodyPayload): Promise<void> {
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
    const filepath = join(incomingFolderPath, filename);
    await writeFile(filepath, bytes);

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

  private async moveRemainingIncomingToLeftovers(incomingFolderPath: string): Promise<void> {
    const leftoversFolderPath = this.imageDownloadPathService.getLeftoversFolderPath(this.scraperConfig.imageDownloadFolder);
    await mkdir(leftoversFolderPath, { recursive: true });
    const entries = await readdir(incomingFolderPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(incomingFolderPath, entry.name);
      if (entry.isFile()) {
        const targetPath = join(leftoversFolderPath, entry.name);
        await rm(targetPath, { force: true });
        await rename(entryPath, targetPath);
        continue;
      }

      if (entry.isDirectory()) {
        await rm(entryPath, { recursive: true, force: true });
      }
    }
  }

}
