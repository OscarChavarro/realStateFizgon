import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';

@Injectable()
export class ChromiumCdpReadinessService {
  private readonly logger = new Logger(ChromiumCdpReadinessService.name);

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    private readonly chromiumPageSyncService: ChromiumPageSyncService
  ) {}

  async waitForReadyEndpoint(host: string, port: number): Promise<void> {
    const timeout = this.chromeConfig.chromeCdpReadyTimeoutMs;
    const start = Date.now();
    let lastError: unknown;

    while (Date.now() - start < timeout) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.chromeConfig.chromeCdpRequestTimeoutMs);

      try {
        const response = await fetch(`http://${host}:${port}/json/version`, {
          signal: controller.signal
        });

        if (response.ok) {
          this.logger.log(`CDP endpoint is ready at ${host}:${port}.`);
          return;
        }
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }

      await this.chromiumPageSyncService.sleep(this.chromeConfig.chromeCdpPollIntervalMs);
    }

    throw new Error(
      `CDP endpoint did not become available in time at ${host}:${port}${lastError ? ` (${String(lastError)})` : ''}`
    );
  }
}
