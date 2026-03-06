import { Injectable, Logger } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { Configuration } from 'src/infrastructure/config/configuration';
import { ChromiumPageSyncService } from 'src/application/services/scraper/chromium/chromium-page-sync.service';

type CdpNetworkClient = {
  Network?: {
    enable?: () => Promise<void>;
    setExtraHTTPHeaders?: (params: { headers: Record<string, string> }) => Promise<void>;
    setUserAgentOverride?: (params: {
      userAgent: string;
      acceptLanguage?: string;
      platform?: string;
      userAgentMetadata?: UserAgentMetadata;
    }) => Promise<void>;
  };
  Emulation?: {
    setUserAgentOverride?: (params: {
      userAgent: string;
      acceptLanguage?: string;
      platform?: string;
      userAgentMetadata?: UserAgentMetadata;
    }) => Promise<void>;
  };
};

type PageTarget = {
  id?: string;
  targetId?: string;
  url?: string;
  type?: string;
};

type HeaderOverrides = {
  userAgentOverride?: {
    userAgent: string;
    acceptLanguage?: string;
    platform?: string;
    userAgentMetadata?: UserAgentMetadata;
  };
  extraHeaders: Record<string, string>;
  signature: string;
};

type UserAgentMetadata = {
  brands: { brand: string; version: string }[];
  fullVersionList?: { brand: string; version: string }[];
  platform: string;
  platformVersion: string;
  architecture: string;
  model: string;
  mobile: boolean;
  bitness?: string;
  wow64?: boolean;
};

@Injectable()
export class ChromiumNetworkHeadersService {
  private readonly logger = new Logger(ChromiumNetworkHeadersService.name);
  private headersTargetLoopRunning = false;
  private readonly targetClients = new Map<string, { client: CdpNetworkClient & { close(): Promise<void> }; signature: string }>();
  private readonly loggedAcceptLanguageNormalizations = new Set<string>();

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageSyncService: ChromiumPageSyncService
  ) {}

  async applyHeaders(client: CdpNetworkClient): Promise<void> {
    const overrides = this.buildOverrides();
    await this.applyOverridesToClient(client, overrides);
  }

  startTargetLoop(cdpHost: string, cdpPort: number, isShuttingDown: () => boolean): void {
    if (this.headersTargetLoopRunning) {
      return;
    }

    this.headersTargetLoopRunning = true;
    void this.runHeadersTargetLoop(cdpHost, cdpPort, isShuttingDown)
      .catch((error) => {
        this.logger.warn(`Network headers target loop failed. ${this.errorToMessage(error)}`);
      })
      .finally(() => {
        this.headersTargetLoopRunning = false;
      });
  }

  private async runHeadersTargetLoop(
    cdpHost: string,
    cdpPort: number,
    isShuttingDown: () => boolean
  ): Promise<void> {
    const pollIntervalMs = Math.max(this.configuration.chromeCdpPollIntervalMs, 250);

    while (!isShuttingDown()) {
      try {
        await this.applyOverridesToOpenTargets(cdpHost, cdpPort);
      } catch (error) {
        this.logger.warn(`Failed to refresh network header targets. ${this.errorToMessage(error)}`);
      }

      await this.chromiumPageSyncService.sleep(pollIntervalMs);
    }
  }

  private async applyOverridesToOpenTargets(cdpHost: string, cdpPort: number): Promise<void> {
    const overrides = this.buildOverrides();
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
      await this.ensureTargetOverrides(target, targetKey, overrides, cdpHost, cdpPort);
    }

    for (const [key, value] of this.targetClients.entries()) {
      if (!activeTargets.has(key)) {
        try {
          await value.client.close();
        } catch {
          // Ignore close errors for disappearing targets.
        }
        this.targetClients.delete(key);
      }
    }
  }

  private async ensureTargetOverrides(
    target: PageTarget,
    targetKey: string,
    overrides: HeaderOverrides,
    cdpHost: string,
    cdpPort: number
  ): Promise<void> {
    const existingTarget = this.targetClients.get(targetKey);
    if (existingTarget) {
      if (existingTarget.signature === overrides.signature) {
        return;
      }

      const applied = await this.applyOverridesToClient(existingTarget.client, overrides);
      if (applied) {
        existingTarget.signature = overrides.signature;
        this.logger.log(`Updated network header overrides for target ${targetKey}.`);
      }
      return;
    }

    try {
      const client = await CDP({ host: cdpHost, port: cdpPort, target }) as CdpNetworkClient & { close(): Promise<void> };
      const applied = await this.applyOverridesToClient(client as CdpNetworkClient, overrides);
      if (applied) {
        this.targetClients.set(targetKey, { client, signature: overrides.signature });
        this.logger.log(`Applied network header overrides for target ${targetKey}.`);
      } else {
        await client.close();
      }
    } catch (error) {
      this.logger.warn(`Failed to apply network headers for ${targetKey}. ${this.errorToMessage(error)}`);
      const existing = this.targetClients.get(targetKey);
      if (existing) {
        try {
          await existing.client.close();
        } catch {
          // Ignore close errors.
        }
        this.targetClients.delete(targetKey);
      }
    }
  }

  private async applyOverridesToClient(client: CdpNetworkClient, overrides: HeaderOverrides): Promise<boolean> {
    if (!client.Network) {
      return false;
    }

    try {
      await client.Network.enable?.();
    } catch (error) {
      this.logger.warn(`Failed to enable Network domain. ${this.errorToMessage(error)}`);
    }

    if (overrides.userAgentOverride) {
      try {
        if (client.Emulation?.setUserAgentOverride) {
          await client.Emulation.setUserAgentOverride(overrides.userAgentOverride);
        } else if (client.Network.setUserAgentOverride) {
          await client.Network.setUserAgentOverride(overrides.userAgentOverride);
        } else {
          this.logger.warn('Neither Emulation.setUserAgentOverride nor Network.setUserAgentOverride is available.');
        }
      } catch (error) {
        this.logger.warn(`Failed to override user agent metadata. ${this.errorToMessage(error)}`);
      }
    }

    try {
      if (Object.keys(overrides.extraHeaders).length > 0 && client.Network.setExtraHTTPHeaders) {
        await client.Network.setExtraHTTPHeaders({ headers: overrides.extraHeaders });
      }
    } catch (error) {
      this.logger.warn(`Failed to set extra headers. ${this.errorToMessage(error)}`);
    }

    return true;
  }

  private buildOverrides(): HeaderOverrides {
    const requestedUserAgent = this.configuration.chromeUserAgent;
    const browserVersion = this.detectBrowserVersion(this.resolveBrowserBinary());
    const userAgent = this.resolveUserAgent(requestedUserAgent, browserVersion);
    const acceptLanguage = this.configuration.chromeAcceptLanguage;
    const cdpAcceptLanguage = this.toCdpAcceptLanguage(acceptLanguage);
    const extraHeaders = { ...this.configuration.chromeExtraHeaders };

    const userAgentMetadata = userAgent ? this.buildUserAgentMetadata(userAgent) : undefined;
    const platform = userAgent ? this.buildNavigatorPlatform(userAgent) : undefined;

    if (acceptLanguage && !('Accept-Language' in extraHeaders)) {
      extraHeaders['Accept-Language'] = acceptLanguage;
    }

    const userAgentOverride = userAgent
      ? {
          userAgent,
          acceptLanguage: cdpAcceptLanguage,
          platform,
          userAgentMetadata
        }
      : undefined;

    return {
      userAgentOverride,
      extraHeaders,
      signature: JSON.stringify({ userAgentOverride, extraHeaders })
    };
  }

  private toCdpAcceptLanguage(acceptLanguage: string): string | undefined {
    const trimmed = (acceptLanguage ?? '').trim();
    if (!trimmed) {
      return undefined;
    }

    const tags = trimmed
      .split(',')
      .map((entry) => entry.split(';')[0].trim())
      .filter((entry) => entry.length > 0);

    if (tags.length === 0) {
      return undefined;
    }

    const normalized = tags.join(',');
    if (normalized !== trimmed) {
      const normalizationKey = `${trimmed}=>${normalized}`;
      if (!this.loggedAcceptLanguageNormalizations.has(normalizationKey)) {
        this.loggedAcceptLanguageNormalizations.add(normalizationKey);
        this.logger.log(`CDP acceptLanguage normalized from "${trimmed}" to "${normalized}".`);
      }
    }
    return normalized;
  }

  private resolveUserAgent(requestedUserAgent: string, browserVersion?: string): string | undefined {
    const trimmed = (requestedUserAgent ?? '').trim();
    if (!trimmed) {
      return undefined;
    }

    if (!browserVersion) {
      return trimmed;
    }

    const { normalized } = this.normalizeUserAgentVersion(trimmed, browserVersion);
    return normalized;
  }

  private normalizeUserAgentVersion(
    userAgent: string,
    browserVersion: string
  ): { normalized: string; changed: boolean; found: boolean } {
    const versionPattern = /(Chrome|Chromium)\/([0-9]+(?:\.[0-9]+){0,3})/gi;
    let found = false;
    const normalized = userAgent.replace(versionPattern, (_match, name: string) => {
      found = true;
      return `${name}/${browserVersion}`;
    });
    return { normalized, changed: found && normalized !== userAgent, found };
  }

  private buildUserAgentMetadata(userAgent: string): UserAgentMetadata | undefined {
    const { fullVersion, majorVersion } = this.extractChromeVersions(userAgent);
    if (!majorVersion) {
      return undefined;
    }

    const { platform, platformVersion } = this.extractPlatformInfo(userAgent);
    const architecture = this.extractArchitecture(userAgent);
    const bitness = architecture === 'arm' ? '64' : '64';

    const brands = [
      { brand: 'Not:A-Brand', version: '99' },
      { brand: 'Google Chrome', version: majorVersion },
      { brand: 'Chromium', version: majorVersion }
    ];

    const fullVersionList = [
      { brand: 'Not:A-Brand', version: '99.0.0.0' },
      { brand: 'Google Chrome', version: fullVersion ?? majorVersion },
      { brand: 'Chromium', version: fullVersion ?? majorVersion }
    ];

    return {
      brands,
      fullVersionList,
      platform,
      platformVersion,
      architecture,
      model: '',
      mobile: false,
      bitness,
      wow64: false
    };
  }

  private extractChromeVersions(userAgent: string): { fullVersion?: string; majorVersion?: string } {
    const match = userAgent.match(/(?:Chrome|Chromium)\/([0-9]+(?:\.[0-9]+){0,3})/);
    if (!match) {
      return {};
    }

    const fullVersion = match[1];
    const majorVersion = fullVersion.split('.')[0];
    return { fullVersion, majorVersion };
  }

  private extractPlatformInfo(userAgent: string): { platform: string; platformVersion: string } {
    const macMatch = userAgent.match(/Mac OS X ([0-9_]+)/i);
    if (macMatch) {
      return { platform: 'macOS', platformVersion: macMatch[1].replace(/_/g, '.') };
    }

    const windowsMatch = userAgent.match(/Windows NT ([0-9.]+)/i);
    if (windowsMatch) {
      return { platform: 'Windows', platformVersion: windowsMatch[1] };
    }

    const androidMatch = userAgent.match(/Android ([0-9.]+)/i);
    if (androidMatch) {
      return { platform: 'Android', platformVersion: androidMatch[1] };
    }

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      const iosMatch = userAgent.match(/OS ([0-9_]+)/i);
      return { platform: 'iOS', platformVersion: iosMatch ? iosMatch[1].replace(/_/g, '.') : '0.0.0' };
    }

    return { platform: 'Linux', platformVersion: '0.0.0' };
  }

  private extractArchitecture(userAgent: string): string {
    if (/arm|aarch64|arm64/i.test(userAgent)) {
      return 'arm';
    }

    if (/x86_64|Win64|x64|Intel/i.test(userAgent)) {
      return 'x86';
    }

    return process.arch === 'arm64' ? 'arm' : 'x86';
  }

  private buildNavigatorPlatform(userAgent: string): string | undefined {
    if (/Mac OS X/i.test(userAgent)) {
      return 'MacIntel';
    }
    if (/Windows NT/i.test(userAgent)) {
      return 'Win32';
    }
    if (/Linux/i.test(userAgent)) {
      return this.extractArchitecture(userAgent) === 'arm' ? 'Linux armv8l' : 'Linux x86_64';
    }
    return undefined;
  }

  private detectBrowserVersion(browserBinary: string): string | undefined {
    try {
      const result = spawnSync(browserBinary, ['--version'], { encoding: 'utf8' });
      const output = `${result.stdout ?? ''} ${result.stderr ?? ''}`.trim();
      if (!output) {
        return undefined;
      }
      const match = output.match(/(\d+\.\d+\.\d+\.\d+|\d+\.\d+\.\d+|\d+\.\d+)/);
      return match ? match[1] : undefined;
    } catch (error) {
      this.logger.warn(`Failed to detect browser version from "${browserBinary}": ${String(error)}`);
      return undefined;
    }
  }

  private resolveBrowserBinary(): string {
    const configuredBinary = this.configuration.chromeBinary;
    const isLinuxArm64 = process.platform === 'linux' && process.arch === 'arm64';

    if (!isLinuxArm64) {
      return configuredBinary;
    }

    const chromiumCandidates = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'chromium',
      'chromium-browser'
    ];

    for (const candidate of chromiumCandidates) {
      if (candidate.startsWith('/')) {
        try {
          accessSync(candidate);
          return candidate;
        } catch {
          continue;
        }
      }

      const probe = spawnSync('which', [candidate], { stdio: 'ignore' });
      if (probe.status === 0) {
        return candidate;
      }
    }

    return configuredBinary;
  }

  private getTargetKey(target: PageTarget): string | undefined {
    return target.id ?? target.targetId ?? (target.url ? target.url.toString().trim() : undefined);
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
