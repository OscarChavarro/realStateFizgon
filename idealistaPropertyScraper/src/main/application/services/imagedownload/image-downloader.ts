import { Inject, Injectable, Logger } from '@nestjs/common';
import { Property } from 'domain/property/property';
import { ImageDownloadPathService } from 'application/services/imagedownload/image-download-path.service';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';
import { NetworkEnabledCdpClient } from 'ports/outbound/browser/network-enabled-cdp-client.port';
import { NetworkLoadingFailedEvent } from 'application/dto/imagedownload/network-loading-failed-event.dto';
import { NetworkLoadingFinishedEvent } from 'application/dto/imagedownload/network-loading-finished-event.dto';
import { NetworkResponseReceivedEvent } from 'application/dto/imagedownload/network-response-received-event.dto';
import { FinalizePropertyImagesUseCase } from 'application/usecases/imagedownload/finalize-property-images.use-case';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';

@Injectable()
export class ImageDownloaderService {
  private readonly logger = new Logger(ImageDownloaderService.name);

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort,
    private readonly imageDownloadPathService: ImageDownloadPathService,
    private readonly imageUrlRulesService: ImageUrlRulesService,
    private readonly imageNetworkCaptureService: ImageNetworkCaptureService,
    private readonly finalizePropertyImagesUseCase: FinalizePropertyImagesUseCase,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort,
    @Inject(SLEEP_PORT)
    private readonly sleepPort: SleepPort
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
        const message = this.errorMessagePort.toErrorMessage(error);
        this.logger.error(`Image download folder validation failed: ${message}`);
        this.logger.error(`Check permissions, free disk space, and path configured in environment.json: "${configuredFolder}".`);
        this.logger.error(
          `NFS/shared-folder access is failing. Keeping pod alive for ${waitSeconds} seconds before retrying validation.`
        );
        await this.sleepPort.sleep(waitMs);
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
