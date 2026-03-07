import { Injectable } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { Configuration } from 'src/infrastructure/config/configuration';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { CdpPageTarget } from 'src/application/services/chromium/cdp-page-target.type';

@Injectable()
export class ChromiumPageTargetService {
  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageSyncService: ChromiumPageSyncService
  ) {}

  async waitForPageTarget(host: string, port: number): Promise<CdpPageTarget | undefined> {
    const timeoutMs = this.configuration.chromeCdpReadyTimeoutMs;
    const pollIntervalMs = this.configuration.chromeCdpPollIntervalMs;
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
        return url.startsWith(this.configuration.scraperHomeUrl);
      }) ?? pageTargets[0] ?? [...targets].reverse().find((target: { type?: string }) => target.type === 'page');

      if (preferredTarget) {
        return preferredTarget as CdpPageTarget;
      }

      await this.chromiumPageSyncService.sleep(pollIntervalMs);
    }

    return undefined;
  }
}
