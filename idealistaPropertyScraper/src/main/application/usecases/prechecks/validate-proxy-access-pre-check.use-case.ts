import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { PROXY_ACCESS_VALIDATOR_PORT } from 'ports/outbound/network/proxy-access-validator.port.token';

import type { ProxyAccessValidatorPort } from 'ports/outbound/network/proxy-access-validator.port';

@Injectable()
export class ValidateProxyAccessPreCheckUseCase {
  private readonly logger = new Logger(ValidateProxyAccessPreCheckUseCase.name);

  constructor(
    private readonly chromeConfig: ChromeConfig,
    @Inject(PROXY_ACCESS_VALIDATOR_PORT)
    private readonly proxyAccessValidatorPort: ProxyAccessValidatorPort
  ) {}

  async execute(): Promise<void> {
    await this.proxyAccessValidatorPort.validateProxyAccessOrWait({
      enabled: this.chromeConfig.proxyEnabled,
      host: this.chromeConfig.proxyHost,
      port: this.chromeConfig.proxyPort,
      retryWaitMs: this.chromeConfig.chromeBrowserLaunchRetryWaitMs,
      logger: this.logger
    });
  }
}
