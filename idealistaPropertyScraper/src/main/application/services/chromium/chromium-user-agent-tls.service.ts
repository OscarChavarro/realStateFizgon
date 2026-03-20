import { Inject, Injectable, Logger } from '@nestjs/common';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';
import { OPERATING_SYSTEM_PROCESS_CONTROL_PORT } from 'ports/outbound/operating-system/operating-system-process-control.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { OperatingSystemProcessControlPort } from 'ports/outbound/operating-system/operating-system-process-control.port';

type LoggerLike = {
  log(message: string): void;
  warn(message: string): void;
};

@Injectable()
export class ChromiumUserAgentTlsService {
  private readonly logger = new Logger(ChromiumUserAgentTlsService.name);
  private resolvedBrowserBinary?: string;
  private browserVersionResolved = false;
  private cachedBrowserVersion?: string;
  private cachedBrowserVersionBinary?: string;

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort,
    @Inject(OPERATING_SYSTEM_PROCESS_CONTROL_PORT)
    private readonly operatingSystemProcessControlPort: OperatingSystemProcessControlPort
  ) {}

  resolveBrowserBinary(logger?: LoggerLike): string {
    if (this.resolvedBrowserBinary) {
      return this.resolvedBrowserBinary;
    }

    const configuredBinary = this.chromeConfig.chromeBinary;
    const isLinuxArm64 = process.platform === 'linux' && process.arch === 'arm64';

    if (!isLinuxArm64) {
      this.resolvedBrowserBinary = configuredBinary;
      return this.resolvedBrowserBinary;
    }

    const chromiumCandidates = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'chromium',
      'chromium-browser'
    ];

    for (const candidate of chromiumCandidates) {
      if (candidate.startsWith('/')) {
        if (this.operatingSystemProcessControlPort.canAccessPath(candidate)) {
          logger?.log(`Detected linux/arm64. Using Chromium binary at "${candidate}".`);
          this.resolvedBrowserBinary = candidate;
          return this.resolvedBrowserBinary;
        }
        continue;
      }

      const probe = this.operatingSystemProcessControlPort.spawnSync('which', [candidate], { stdio: 'ignore' });
      if (probe.status === 0) {
        logger?.log(`Detected linux/arm64. Using Chromium binary "${candidate}" from PATH.`);
        this.resolvedBrowserBinary = candidate;
        return this.resolvedBrowserBinary;
      }
    }

    logger?.warn(
      `Detected linux/arm64 but no Chromium binary was found. Falling back to configured binary "${configuredBinary}".`
    );
    this.resolvedBrowserBinary = configuredBinary;
    return this.resolvedBrowserBinary;
  }

  getBrowserVersion(browserBinary?: string, logger?: LoggerLike): string | undefined {
    const resolvedBrowserBinary = browserBinary ?? this.resolveBrowserBinary();
    if (this.browserVersionResolved && this.cachedBrowserVersionBinary === resolvedBrowserBinary) {
      return this.cachedBrowserVersion;
    }

    this.browserVersionResolved = true;
    this.cachedBrowserVersionBinary = resolvedBrowserBinary;

    try {
      const result = this.operatingSystemProcessControlPort.spawnSync(
        resolvedBrowserBinary,
        ['--version'],
        { encoding: 'utf8' }
      );
      const output = `${result.stdout ?? ''} ${result.stderr ?? ''}`.trim();
      if (!output) {
        this.cachedBrowserVersion = undefined;
        return undefined;
      }

      const match = output.match(/(\d+\.\d+\.\d+\.\d+|\d+\.\d+\.\d+|\d+\.\d+)/);
      this.cachedBrowserVersion = match ? match[1] : undefined;
      return this.cachedBrowserVersion;
    } catch (error) {
      this.cachedBrowserVersion = undefined;
      const message = this.errorMessagePort.toErrorMessage(error);
      (logger ?? this.logger).warn(
        `Failed to detect browser version from "${resolvedBrowserBinary}": ${message}`
      );
      return undefined;
    }
  }

  resolveUserAgentForLaunch(
    requestedUserAgent: string,
    browserVersion: string | undefined,
    logger: LoggerLike
  ): string | undefined {
    const trimmed = requestedUserAgent.trim();
    if (!browserVersion) {
      if (!trimmed) {
        return undefined;
      }

      logger.warn('Unable to detect browser version. Using configured userAgent without TLS alignment.');
      return trimmed;
    }

    if (!trimmed) {
      return this.buildDefaultUserAgent(browserVersion);
    }

    const { normalized, changed, found } = this.normalizeUserAgentVersion(trimmed, browserVersion);
    if (!found) {
      logger.warn(
        'Configured userAgent has no Chrome/Chromium version. Replacing with a normalized UA to keep TLS coherent.'
      );
      return this.buildDefaultUserAgent(browserVersion);
    }

    if (changed) {
      logger.warn(
        `Configured userAgent version does not match browser version ${browserVersion}. Using normalized UA.`
      );
      logger.warn(`Configured userAgent: ${trimmed}`);
      logger.warn(`Normalized userAgent: ${normalized}`);
    }

    return normalized;
  }

  resolveUserAgentForHeaders(
    requestedUserAgent: string,
    browserVersion: string | undefined
  ): string | undefined {
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

  private buildDefaultUserAgent(browserVersion: string): string {
    return `Mozilla/5.0 (${this.getPlatformToken()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
  }

  private getPlatformToken(): string {
    if (process.platform === 'darwin') {
      return 'Macintosh; Intel Mac OS X 10_15_7';
    }
    if (process.platform === 'win32') {
      return 'Windows NT 10.0; Win64; x64';
    }
    return process.arch === 'arm64' ? 'X11; Linux aarch64' : 'X11; Linux x86_64';
  }
}
