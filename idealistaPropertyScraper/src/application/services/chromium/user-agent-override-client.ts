import { Logger } from '@nestjs/common';
import { CdpNetworkClient } from 'src/application/services/chromium/cdp-network-client.type';
import { UserAgentOverridePayload } from 'src/application/services/chromium/user-agent-override-payload.type';

export class UserAgentOverrideClient {
  constructor(
    private readonly client: CdpNetworkClient,
    private readonly logger: Logger
  ) {}

  async apply(override?: UserAgentOverridePayload): Promise<void> {
    if (!override) {
      return;
    }

    try {
      if (this.client.Emulation?.setUserAgentOverride) {
        await this.client.Emulation.setUserAgentOverride(override);
      } else if (this.client.Network?.setUserAgentOverride) {
        await this.client.Network.setUserAgentOverride(override);
      } else {
        this.logger.warn('Neither Emulation.setUserAgentOverride nor Network.setUserAgentOverride is available.');
      }
    } catch (error) {
      this.logger.warn(`Failed to override user agent metadata. ${this.errorToMessage(error)}`);
    }
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
