import { Injectable, Logger } from '@nestjs/common';
import { Property } from 'src/domain/property/property.model';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';
import { ImageNetworkCaptureService } from 'src/application/services/imagedownload/image-network-capture.service';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';
import { NetworkEnabledCdpClient } from 'src/application/services/imagedownload/network-enabled-cdp-client.type';
import { NetworkLoadingFailedEvent } from 'src/application/services/imagedownload/network-loading-failed-event.type';
import { NetworkLoadingFinishedEvent } from 'src/application/services/imagedownload/network-loading-finished-event.type';
import { NetworkResponseReceivedEvent } from 'src/application/services/imagedownload/network-response-received-event.type';
import { FinalizePropertyImagesUseCase } from 'src/application/usecases/imagedownload/finalize-property-images.use-case';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { toErrorMessage } from 'src/infrastructure/error-message';
import { sleep } from 'src/infrastructure/sleep';

@Injectable()
export class ImageDownloader {
  private readonly logger = new Logger(ImageDownloader.name);

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly scraperConfig: ScraperConfig,
    private readonly imageDownloadPathService: ImageDownloadPathService,
    private readonly imageUrlRulesService: ImageUrlRulesService,
    private readonly imageNetworkCaptureService: ImageNetworkCaptureService,
    private readonly finalizePropertyImagesUseCase: FinalizePropertyImagesUseCase
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
        async (payload) => this.finalizePropertyImagesUseCase.persistCapturedImage(payload),
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
    await this.finalizePropertyImagesUseCase.execute(property);
  }
}
