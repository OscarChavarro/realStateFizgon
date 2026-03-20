import { Injectable, Logger } from '@nestjs/common';
import { ProxyService } from '@real-state-fizgon/proxy';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';

@Injectable()
export class ValidateProxyAccessPreCheckUseCase {
  private readonly logger = new Logger(ValidateProxyAccessPreCheckUseCase.name);
  private readonly proxyService = new ProxyService();

  constructor(private readonly chromeConfig: ChromeConfig) {}

  async execute(): Promise<void> {
    await this.proxyService.validateProxyAccessOrWait({
      enabled: this.chromeConfig.proxyEnabled,
      host: this.chromeConfig.proxyHost,
      port: this.chromeConfig.proxyPort,
      retryWaitMs: this.chromeConfig.chromeBrowserLaunchRetryWaitMs,
      logger: this.logger
    });
  }
}
