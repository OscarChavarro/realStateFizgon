import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProxyService } from '@real-state-fizgon/proxy';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class InfrastructurePreCheckService {
  private readonly logger = new Logger(InfrastructurePreCheckService.name);
  private readonly proxyService = new ProxyService();

  constructor(
    private readonly chromeConfig: ChromeConfig,
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
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

    await this.propertyPersistencePort.validateConnectionOrExit();
    await this.imageDownloader.validateImageDownloadFolder();
  }
}
