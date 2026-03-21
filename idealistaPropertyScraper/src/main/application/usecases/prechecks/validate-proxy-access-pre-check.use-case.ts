import { Inject, Injectable, Logger } from '@nestjs/common';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { PROXY_ACCESS_VALIDATOR_PORT } from 'ports/outbound/network/proxy-access-validator.port.token';

import type { ProxyAccessValidatorPort } from 'ports/outbound/network/proxy-access-validator.port';

@Injectable()
export class ValidateProxyAccessPreCheckUseCase {
  private readonly logger = new Logger(ValidateProxyAccessPreCheckUseCase.name);

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    @Inject(PROXY_ACCESS_VALIDATOR_PORT)
    private readonly proxyAccessValidatorPort: ProxyAccessValidatorPort
  ) {}

  async execute(): Promise<void> {
    const validationResult = await this.proxyAccessValidatorPort.validateProxyAccessOrWait({
      enabled: this.chromeConfig.proxyEnabled,
      host: this.chromeConfig.proxyHost,
      port: this.chromeConfig.proxyPort,
      retryWaitMs: this.chromeConfig.chromeBrowserLaunchRetryWaitMs
    });

    if (validationResult.status === 'proxy_disabled') {
      this.logger.log('Proxy validation completed: proxy disabled in configuration.');
      return;
    }

    this.logger.log(
      `Proxy validation completed: proxy connectivity available for ${validationResult.host}:${String(validationResult.port)}.`
    );
  }
}
