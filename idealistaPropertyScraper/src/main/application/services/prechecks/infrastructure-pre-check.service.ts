import { Injectable, Logger } from '@nestjs/common';
import { ProxyService } from '@real-state-fizgon/proxy';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';

@Injectable()
export class InfrastructurePreCheckService {
  private readonly logger = new Logger(InfrastructurePreCheckService.name);
  private readonly proxyService = new ProxyService();

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async runBeforeScraperStartup(): Promise<void> {
    await this.proxyService.validateProxyAccessOrWait({
      enabled: this.chromeConfig.proxyEnabled,
      host: this.chromeConfig.proxyHost,
      port: this.chromeConfig.proxyPort,
      retryWaitMs: this.chromeConfig.chromeBrowserLaunchRetryWaitMs,
      logger: this.logger
    });

    await this.mongoDatabaseService.validateConnectionOrExit();
    await this.imageDownloader.validateImageDownloadFolder();
  }
}
