import { Injectable } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { CdpPageTarget } from 'src/application/services/chromium/cdp-page-target.type';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

@Injectable()
export class ChromiumPageTargetService {
  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly scraperConfig: ScraperConfig,
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
