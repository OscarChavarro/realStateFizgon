import { Injectable, Logger } from '@nestjs/common';
import { ProxyService } from '@real-state-fizgon/proxy';

import type {
  ProxyAccessValidationRequest,
  ProxyAccessValidationResult,
  ProxyAccessValidatorPort
} from 'ports/outbound/network/proxy-access-validator.port';

@Injectable()
export class ProxyAccessValidatorService implements ProxyAccessValidatorPort {
  private readonly logger = new Logger(ProxyAccessValidatorService.name);
  private readonly proxyService = new ProxyService();

  async validateProxyAccessOrWait(request: ProxyAccessValidationRequest): Promise<ProxyAccessValidationResult> {
    const sdkRequest = {
      ...request,
      logger: {
        log: (message: string): void => this.logger.log(message),
        error: (message: string): void => this.logger.error(message)
      }
    };

    await this.proxyService.validateProxyAccessOrWait(sdkRequest);
    if (!request.enabled) {
      return {
        status: 'proxy_disabled',
        enabled: false
      };
    }

    return {
      status: 'proxy_validated',
      enabled: true,
      host: request.host,
      port: request.port
    };
  }
}
