import { Injectable, Logger } from '@nestjs/common';
import { toErrorMessage } from 'src/infrastructure/error-message';
type CdpBrowser = {
  grantPermissions?(params: { origin: string; permissions: string[] }): Promise<void>;
};

type CdpClient = {
  Browser?: CdpBrowser;
};

type PageFrameNavigatedEvent = {
  frame?: {
    url?: string;
  };
};

type CdpPage = {
  frameNavigated(callback: (event: PageFrameNavigatedEvent) => void): void;
};

@Injectable()
export class ChromiumPermissionRegistrarService {
  private readonly logger = new Logger(ChromiumPermissionRegistrarService.name);
  private readonly allowedOrigins = new Set<string>();
  private readonly pendingOrigins = new Set<string>();

  constructor() {}

  registerPageNavigationListener(client: CdpClient, page: CdpPage, allowlist?: string[]): void {
    page.frameNavigated((event) => {
      const url = event?.frame?.url ?? '';
      void this.ensureOriginIsAuthorized(client, url, allowlist);
    });
  }

  async ensureOriginIsAuthorized(client: CdpClient, urlOrOrigin: string, allowlist?: string[]): Promise<void> {
    const origin = this.toOrigin(urlOrOrigin);
    if (!origin) {
      return;
    }

    if (!this.isOriginAllowed(origin, allowlist)) {
      return;
    }

    await this.grantGeolocationPermission(client, origin);
  }

  async grantGeolocationPermissions(client: CdpClient, allowlist: string[]): Promise<void> {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return;
    }

    for (const entry of allowlist) {
      const origin = this.toOrigin(entry);
      if (!origin) {
        continue;
      }

      await this.grantGeolocationPermission(client, origin);
    }
  }

  private async grantGeolocationPermission(client: CdpClient, origin: string): Promise<void> {
    if (this.allowedOrigins.has(origin) || this.pendingOrigins.has(origin)) {
      return;
    }

    if (!client.Browser?.grantPermissions) {
      this.logger.warn('CDP Browser.grantPermissions not available. Skipping permission grant.');
      return;
    }

    this.pendingOrigins.add(origin);
    try {
      await client.Browser.grantPermissions({
        origin,
        permissions: ['geolocation']
      });
      this.allowedOrigins.add(origin);
      this.logger.log(`Granted geolocation permissions for ${origin}.`);
    } catch (error) {
      this.logger.warn(`Failed to grant geolocation permissions for ${origin}. ${toErrorMessage(error)}`);
    } finally {
      this.pendingOrigins.delete(origin);
    }
  }

  private isOriginAllowed(origin: string, allowlist?: string[]): boolean {
    if (!allowlist || allowlist.length === 0) {
      return true;
    }

    for (const entry of allowlist) {
      const allowedOrigin = this.toOrigin(entry);
      if (allowedOrigin && allowedOrigin === origin) {
        return true;
      }
    }

    return false;
  }

  private toOrigin(urlOrOrigin: string): string | undefined {
    const trimmed = (urlOrOrigin ?? '').toString().trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return undefined;
      }
      return parsed.origin;
    } catch {
      return undefined;
    }
  }

}
