import { Logger } from '@nestjs/common';
import { CdpNetworkClient } from 'src/application/services/scraper/chromium/cdp-network-client.type';

export class NetworkHeaderClient {
  constructor(
    private readonly client: CdpNetworkClient,
    private readonly logger: Logger
  ) {}

  hasNetworkDomain(): boolean {
    return Boolean(this.client.Network);
  }

  async enableNetworkDomain(): Promise<void> {
    try {
      await this.client.Network?.enable?.();
    } catch (error) {
      this.logger.warn(`Failed to enable Network domain. ${this.errorToMessage(error)}`);
    }
  }

  async applyExtraHeaders(headers: Record<string, string>): Promise<void> {
    try {
      if (Object.keys(headers).length > 0 && this.client.Network?.setExtraHTTPHeaders) {
        await this.client.Network.setExtraHTTPHeaders({ headers });
      }
    } catch (error) {
      this.logger.warn(`Failed to set extra headers. ${this.errorToMessage(error)}`);
    }
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
