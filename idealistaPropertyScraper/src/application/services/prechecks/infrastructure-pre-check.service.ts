import { Injectable, Logger } from '@nestjs/common';
import { ProxyService } from '@real-state-fizgon/proxy';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { Configuration } from 'src/infrastructure/config/configuration';

@Injectable()
export class InfrastructurePreCheckService {
  private readonly logger = new Logger(InfrastructurePreCheckService.name);
  private readonly proxyService = new ProxyService();

  constructor(
    private readonly configuration: Configuration,
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async runBeforeScraperStartup(): Promise<void> {
    await this.proxyService.validateProxyAccessOrWait({
      enabled: this.configuration.proxyEnabled,
      host: this.configuration.proxyHost,
      port: this.configuration.proxyPort,
      retryWaitMs: this.configuration.chromeBrowserLaunchRetryWaitMs,
      logger: this.logger
    });

    await this.mongoDatabaseService.validateConnectionOrExit();
    await this.imageDownloader.validateImageDownloadFolder();
  }
}
