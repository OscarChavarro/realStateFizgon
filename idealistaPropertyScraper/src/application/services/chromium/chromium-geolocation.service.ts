import { Injectable, Logger } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ChromiumPermissionRegistrarService } from 'src/application/services/chromium/chromium-permission-registrar.service';
import { toErrorMessage } from 'src/infrastructure/error-message';

type CdpEmulationClient = {
  Emulation?: {
    setGeolocationOverride?: (params: { latitude: number; longitude: number; accuracy: number }) => Promise<void>;
  };
};

type CdpBrowserClient = {
  Browser?: {
    grantPermissions?: (params: { origin: string; permissions: string[] }) => Promise<void>;
  };
};

type CdpPage = {
  frameNavigated(callback: (event: { frame?: { url?: string } }) => void): void;
};

type PageTarget = {
  id?: string;
  targetId?: string;
  url?: string;
  type?: string;
};

@Injectable()
export class ChromiumGeolocationService {
  private readonly logger = new Logger(ChromiumGeolocationService.name);
  private geolocationTargetLoopRunning = false;
  private readonly geolocationTargetOrigins = new Map<string, string>();

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly chromiumPermissionRegistrarService: ChromiumPermissionRegistrarService
  ) {}

  registerPageNavigationListener(client: CdpBrowserClient, page: CdpPage): void {
    const allowlist = this.chromeConfig.geolocationAllowlist;
    this.chromiumPermissionRegistrarService.registerPageNavigationListener(client, page, allowlist);
  }

  async ensureOriginIsAuthorized(client: CdpBrowserClient, urlOrOrigin: string): Promise<void> {
    const allowlist = this.chromeConfig.geolocationAllowlist;
    await this.chromiumPermissionRegistrarService.ensureOriginIsAuthorized(client, urlOrOrigin, allowlist);
  }

  async applyGeolocationOverride(client: CdpEmulationClient): Promise<void> {
    const geolocationOverride = this.chromeConfig.geolocationOverride;
    if (geolocationOverride && client.Emulation?.setGeolocationOverride) {
      try {
        await client.Emulation.setGeolocationOverride(geolocationOverride);
      } catch (error) {
        this.logger.warn(`Failed to set geolocation override. ${toErrorMessage(error)}`);
      }
    }
  }

  async grantStartupPermissions(cdpHost: string, cdpPort: number): Promise<void> {
    const geolocationAllowlist = this.chromeConfig.geolocationAllowlist;
    if (geolocationAllowlist.length === 0) {
      return;
    }

    let client: { close(): Promise<void> } | undefined;
    try {
      const versionInfo = (await CDP.Version({ host: cdpHost, port: cdpPort })) as {
        webSocketDebuggerUrl?: string;
      };
      const webSocketDebuggerUrl = versionInfo?.webSocketDebuggerUrl;
      if (!webSocketDebuggerUrl) {
        this.logger.warn('CDP version info did not include a browser WebSocket URL. Skipping geolocation pre-grant.');
        return;
      }

      const browserClient = await CDP({ target: webSocketDebuggerUrl });
      client = browserClient as { close(): Promise<void> };
      await this.chromiumPermissionRegistrarService.grantGeolocationPermissions(browserClient, geolocationAllowlist);
    } catch (error) {
      this.logger.warn(`Failed to pre-grant geolocation permissions. ${toErrorMessage(error)}`);
    } finally {
      if (client) {
        await client.close();
      }
    }
  }

  startTargetLoop(cdpHost: string, cdpPort: number, isShuttingDown: () => boolean): void {
    if (this.geolocationTargetLoopRunning) {
      return;
    }

    if (!this.chromeConfig.geolocationOverride) {
      return;
    }

    this.geolocationTargetLoopRunning = true;
    void this.runGeolocationTargetLoop(cdpHost, cdpPort, isShuttingDown)
      .catch((error) => {
        this.logger.warn(`Geolocation target loop failed. ${toErrorMessage(error)}`);
      })
      .finally(() => {
        this.geolocationTargetLoopRunning = false;
      });
  }

  private async runGeolocationTargetLoop(
    cdpHost: string,
    cdpPort: number,
    isShuttingDown: () => boolean
  ): Promise<void> {
    const pollIntervalMs = Math.max(this.chromeConfig.chromeCdpPollIntervalMs, 2000);

    while (!isShuttingDown()) {
      try {
        await this.applyGeolocationOverrideToOpenTargets(cdpHost, cdpPort);
      } catch (error) {
        this.logger.warn(`Failed to refresh geolocation targets. ${toErrorMessage(error)}`);
      }

      await this.chromiumPageSyncService.sleep(pollIntervalMs);
    }
  }

  private async applyGeolocationOverrideToOpenTargets(cdpHost: string, cdpPort: number): Promise<void> {
    const geolocationOverride = this.chromeConfig.geolocationOverride;
    if (!geolocationOverride) {
      return;
    }

    const allowlist = this.chromeConfig.geolocationAllowlist;
    const targets = await CDP.List({ host: cdpHost, port: cdpPort });
    const activeTargets = new Set<string>();

    for (const target of targets as PageTarget[]) {
      if (target.type !== 'page') {
        continue;
      }

      const targetKey = this.getTargetKey(target);
      if (!targetKey) {
        continue;
      }

      activeTargets.add(targetKey);
      const url = (target.url ?? '').toString().trim();
      const origin = this.toOrigin(url);
      if (!origin) {
        continue;
      }

      if (!this.isOriginAllowed(origin, allowlist)) {
        continue;
      }

      if (this.geolocationTargetOrigins.get(targetKey) === origin) {
        continue;
      }

      await this.applyGeolocationOverrideToTarget(target, targetKey, origin, cdpHost, cdpPort);
    }

    for (const key of this.geolocationTargetOrigins.keys()) {
      if (!activeTargets.has(key)) {
        this.geolocationTargetOrigins.delete(key);
      }
    }
  }

  private async applyGeolocationOverrideToTarget(
    target: PageTarget,
    targetKey: string,
    origin: string,
    cdpHost: string,
    cdpPort: number
  ): Promise<void> {
    let client: { close(): Promise<void> } | undefined;
    try {
      client = await CDP({ host: cdpHost, port: cdpPort, target });
      await this.applyGeolocationOverride(client as CdpEmulationClient);
      this.geolocationTargetOrigins.set(targetKey, origin);
    } catch (error) {
      this.logger.warn(`Failed to apply geolocation override for ${targetKey}. ${toErrorMessage(error)}`);
    } finally {
      if (client) {
        await client.close();
      }
    }
  }

  private getTargetKey(target: PageTarget): string | undefined {
    return target.id ?? target.targetId ?? (target.url ? target.url.toString().trim() : undefined);
  }

  private isOriginAllowed(origin: string, allowlist: string[]): boolean {
    if (allowlist.length === 0) {
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
