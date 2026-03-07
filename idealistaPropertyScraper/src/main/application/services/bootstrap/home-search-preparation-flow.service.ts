import { Injectable, Logger } from '@nestjs/common';
import CDP = require('chrome-remote-interface');
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/chromium/chromium-network-headers.service';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ChromiumPageTargetService } from 'src/application/services/chromium/chromium-page-target.service';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

@Injectable()
export class HomeSearchPreparationFlowService {
  private readonly logger = new Logger(HomeSearchPreparationFlowService.name);
  private readonly initialHardeningStabilizationWaitMs = 5000;

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly scraperConfig: ScraperConfig,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly chromiumPageTargetService: ChromiumPageTargetService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService
  ) {}

  async execute(host: string, port: number): Promise<void> {
    const selectedTarget = await this.chromiumPageTargetService.waitForPageTarget(host, port);
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Loading initial home page on target ${String(selectedTarget.id ?? 'unknown')}.`);
    const client = await CDP({ host, port, target: selectedTarget }) as ScraperCdpClient;

    try {
      const { Page, Runtime } = client;
      await Page.enable();
      await Runtime.enable();
      const initialUrl = await Runtime.evaluate({
        expression: 'window.location.href',
        returnByValue: true
      });
      const initialUrlValue = String(initialUrl.result?.value ?? '').trim();
      if (initialUrlValue !== 'about:blank') {
        this.logger.warn(`Initial target URL is "${initialUrlValue}". Forcing about:blank before first hardened navigation.`);
        await Page.navigate({ url: 'about:blank' });
        await this.chromiumPageSyncService.waitForPageLoad(
          Page,
          Runtime,
          this.chromeConfig.chromeCdpReadyTimeoutMs,
          this.chromeConfig.chromeCdpPollIntervalMs
        );
      }

      await this.chromiumNetworkHeadersService.applyHeaders(client);
      this.chromiumGeolocationService.registerPageNavigationListener(client, Page);
      await this.chromiumGeolocationService.ensureOriginIsAuthorized(client, this.scraperConfig.scraperHomeUrl);
      await this.chromiumGeolocationService.applyGeolocationOverride(client);
      this.logger.log(
        `Waiting ${Math.floor(this.initialHardeningStabilizationWaitMs / 1000)} seconds after hardening before first target navigation.`
      );
      await this.chromiumPageSyncService.sleep(this.initialHardeningStabilizationWaitMs);
      await Page.navigate({ url: this.scraperConfig.scraperHomeUrl });
      await this.chromiumPageSyncService.waitForPageLoad(
        Page,
        Runtime,
        this.chromeConfig.chromeCdpReadyTimeoutMs,
        this.chromeConfig.chromeCdpPollIntervalMs
      );
      this.logger.log('Initial home page load complete. Scraper will remain idle until requested.');
    } finally {
      await client.close();
    }
  }
}
