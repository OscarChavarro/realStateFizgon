import { Injectable } from '@nestjs/common';
import { ProxyService } from '@real-state-fizgon/proxy';

import type {
  ProxyAccessValidationRequest,
  ProxyAccessValidatorPort
} from 'ports/outbound/network/proxy-access-validator.port';

@Injectable()
export class ProxyAccessValidatorService implements ProxyAccessValidatorPort {
  private readonly proxyService = new ProxyService();

  async validateProxyAccessOrWait(request: ProxyAccessValidationRequest): Promise<void> {
    await this.proxyService.validateProxyAccessOrWait(request);
  }
}
