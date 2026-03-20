import { Inject, Injectable  } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { CdpPageTarget } from 'application/dto/browser/cdp-page-target.dto';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';

@Injectable()
export class ChromiumPageTargetService {
  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort,
    private readonly chromiumPageSyncService: ChromiumPageSyncService
  ) {}

  async waitForPageTarget(host: string, port: number): Promise<CdpPageTarget | undefined> {
    const timeoutMs = this.chromeConfig.chromeCdpReadyTimeoutMs;
    const pollIntervalMs = this.chromeConfig.chromeCdpPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const targets = await CDP.List({ host, port });
      const pageTargets = [...targets]
        .filter((target: { type?: string }) => target.type === 'page')
        .filter((target: { url?: string }) => {
          const url = (target.url ?? '').trim().toLowerCase();
          return !url.startsWith('devtools://');
        });

      const preferredTarget = pageTargets.find((target: { url?: string }) => {
        const url = (target.url ?? '').trim();
        return url.startsWith(this.scraperConfig.scraperHomeUrl);
      }) ?? pageTargets[0] ?? [...targets].reverse().find((target: { type?: string }) => target.type === 'page');

      if (preferredTarget) {
        return preferredTarget as CdpPageTarget;
      }

      await this.chromiumPageSyncService.sleep(pollIntervalMs);
    }

    return undefined;
  }
}
