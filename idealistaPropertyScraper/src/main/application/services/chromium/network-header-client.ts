import { Logger } from '@nestjs/common';
import { CdpNetworkClient } from 'ports/outbound/browser/cdp-network-client.port';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

export class NetworkHeaderClient {
  constructor(
    private readonly client: CdpNetworkClient,
    private readonly logger: Logger,
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  hasNetworkDomain(): boolean {
    return Boolean(this.client.Network);
  }

  async enableNetworkDomain(): Promise<void> {
    try {
      await this.client.Network?.enable?.();
    } catch (error) {
      this.logger.warn(`Failed to enable Network domain. ${this.errorMessagePort.toErrorMessage(error)}`);
    }
  }

  async applyExtraHeaders(headers: Record<string, string>): Promise<void> {
    try {
      if (Object.keys(headers).length > 0 && this.client.Network?.setExtraHTTPHeaders) {
        await this.client.Network.setExtraHTTPHeaders({ headers });
      }
    } catch (error) {
      this.logger.warn(`Failed to set extra headers. ${this.errorMessagePort.toErrorMessage(error)}`);
    }
  }

}
