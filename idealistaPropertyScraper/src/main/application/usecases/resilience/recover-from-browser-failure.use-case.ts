import { Injectable, Logger } from '@nestjs/common';
import { ChromiumCdpReadinessService } from 'application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumGeolocationService } from 'application/services/chromium/chromium-geolocation.service';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { ChromiumProcessLifecycleService } from 'application/services/chromium/chromium-process-lifecycle.service';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import { ScraperState } from 'domain/states/scraper-state.enum';

@Injectable()
export class RecoverFromBrowserFailureUseCase {
  private readonly logger = new Logger(RecoverFromBrowserFailureUseCase.name);

  constructor(
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly chromiumProcessLifecycleService: ChromiumProcessLifecycleService,
    private readonly chromiumCdpReadinessService: ChromiumCdpReadinessService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly scraperStateMachineService: ScraperStateMachineService
  ) {}

  async execute(params: {
    reason: string;
    cdpHost: string;
    cdpPort: number;
    browserFailureRecoveryWaitMs: number;
    isShuttingDown: () => boolean;
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  }): Promise<void> {
    const waitSeconds = Math.floor(params.browserFailureRecoveryWaitMs / 1000);

    this.logger.error(`Browser failure detected: ${params.reason}`);
    this.chromiumProcessLifecycleService.stopChromiumProcess();
    await this.chromiumPageSyncService.sleep(1000);
    this.chromiumProcessLifecycleService.forceKillChromiumProcess();
    this.logger.error(`Browser will be restarted after waiting ${waitSeconds} seconds.`);

    await this.chromiumPageSyncService.sleep(params.browserFailureRecoveryWaitMs);
    if (params.isShuttingDown()) {
      return;
    }

    await this.chromiumProcessLifecycleService.launchChromiumProcess(
      params.cdpPort,
      params.onUnexpectedExit,
      params.isShuttingDown
    );
    await this.chromiumCdpReadinessService.waitForReadyEndpoint(params.cdpHost, params.cdpPort);
    await this.chromiumGeolocationService.grantStartupPermissions(params.cdpHost, params.cdpPort);
    this.scraperStateMachineService.setState(ScraperState.IDLE);
    this.logger.log('Browser restart completed. Scraper state was set to IDLE.');
  }
}
