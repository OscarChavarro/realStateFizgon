import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationSourceService } from 'src/infrastructure/config/settings/configuration-source.service';

@Injectable()
export class ChromeConfig {
  private readonly logger = new Logger(ChromeConfig.name);

  constructor(private readonly configurationSourceService: ConfigurationSourceService) {}

  get chromeBinary(): string {
    return this.configurationSourceService.environment.chrome.binary;
  }

  get chromePath(): string {
    const path = (this.configurationSourceService.secrets.chrome?.path ?? '').trim();
    return path || '/tmp/googleChromeIdealistaScraper';
  }

  get chromeUserAgent(): string {
    return (this.configurationSourceService.secrets.chrome?.userAgent ?? '').trim();
  }

  get chromeAcceptLanguage(): string {
    return (this.configurationSourceService.secrets.chrome?.acceptLanguage ?? '').trim();
  }

  get chromeExtraHeaders(): Record<string, string> {
    const extra = this.configurationSourceService.secrets.chrome?.extraHeaders;
    if (!extra || typeof extra !== 'object') {
      return {};
    }

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(extra)) {
      const headerKey = (key ?? '').toString().trim();
      const headerValue = (value ?? '').toString().trim();
      if (!headerKey || !headerValue) {
        continue;
      }
      sanitized[headerKey] = headerValue;
    }
    return sanitized;
  }

  get chromiumOptions(): string[] {
    const baseOptions = this.configurationSourceService.secrets.chrome?.chromiumOptions ?? [];
    return [...baseOptions, ...this.chromiumProxyOptions(), ...this.chromiumUserAgentOptions()];
  }

  get proxyEnabled(): boolean {
    return this.configurationSourceService.secrets.proxy?.enable ?? false;
  }

  get proxyHost(): string {
    return (this.configurationSourceService.secrets.proxy?.host ?? '').trim();
  }

  get proxyPort(): number {
    const rawPort = this.configurationSourceService.secrets.proxy?.port;
    const port = typeof rawPort === 'number' ? rawPort : Number((rawPort ?? '').trim());
    return Number.isFinite(port) ? port : 0;
  }

  get geolocationOverride(): { latitude: number; longitude: number; accuracy: number } | undefined {
    const geolocation = this.configurationSourceService.secrets.geolocation;
    if (!geolocation) {
      return undefined;
    }

    const latitude = Number(geolocation.latitude);
    const longitude = Number(geolocation.longitude);
    const accuracy = Number.isFinite(geolocation.accuracy) ? Number(geolocation.accuracy) : 50;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.logger.warn('Invalid geolocation configuration. Skipping geolocation override.');
      return undefined;
    }

    return { latitude, longitude, accuracy };
  }

  get geolocationAllowlist(): string[] {
    const allowlist = this.configurationSourceService.secrets.geolocation?.allowlist;
    if (!Array.isArray(allowlist)) {
      return [];
    }

    return allowlist
      .map((entry) => (entry ?? '').toString().trim())
      .filter((entry) => entry.length > 0);
  }

  get chromeCdpReadyTimeoutMs(): number {
    return this.configurationSourceService.environment.timeouts?.chrome?.cdpreadytimeout ?? 60000;
  }

  get chromeCdpRequestTimeoutMs(): number {
    return this.configurationSourceService.environment.timeouts?.chrome?.cdprequesttimeout ?? 2000;
  }

  get chromeCdpPollIntervalMs(): number {
    return this.configurationSourceService.environment.timeouts?.chrome?.cdppollinterval ?? 500;
  }

  get chromeOriginErrorReloadWaitMs(): number {
    return this.configurationSourceService.environment.timeouts?.chrome?.originerrorreloadwait ?? 1000;
  }

  get chromeExpressionTimeoutMs(): number {
    return this.configurationSourceService.environment.timeouts?.chrome?.expressiontimeout ?? 30000;
  }

  get chromeExpressionPollIntervalMs(): number {
    return this.configurationSourceService.environment.timeouts?.chrome?.expressionpollinterval ?? 200;
  }

  get chromeBrowserLaunchRetryWaitMs(): number {
    return Math.max(0, this.configurationSourceService.environment.timeouts?.chrome?.browserlaunchretrywaitms ?? 3600000);
  }

  private chromiumProxyOptions(): string[] {
    if (!this.proxyEnabled) {
      return [];
    }

    const host = (this.configurationSourceService.secrets.proxy?.host ?? '').trim();
    const rawPort = this.configurationSourceService.secrets.proxy?.port;
    const port = typeof rawPort === 'number'
      ? String(rawPort)
      : (rawPort ?? '').trim();

    if (!host || !port) {
      return [];
    }

    return [`--proxy-server=http://${host}:${port}`];
  }

  private chromiumUserAgentOptions(): string[] {
    const userAgent = this.chromeUserAgent;
    if (!userAgent) {
      return [];
    }

    return [`--user-agent=${userAgent}`];
  }
}
