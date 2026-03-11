import { Injectable, Logger } from '@nestjs/common';
import { ChromiumCdpReadinessService } from 'src/application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/chromium/chromium-process-lifecycle.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { toErrorMessage } from 'src/infrastructure/error-message';

@Injectable()
export class ChromiumFailureGuardService {
  private readonly logger = new Logger(ChromiumFailureGuardService.name);
  private recoveryInProgress = false;

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly chromiumProcessLifecycleService: ChromiumProcessLifecycleService,
    private readonly chromiumCdpReadinessService: ChromiumCdpReadinessService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly scraperStateMachineService: ScraperStateMachineService
  ) {}

  async handleUnexpectedChromeExit(params: {
    code: number | null;
    signal: NodeJS.Signals | null;
    cdpHost: string;
    cdpPort: number;
    browserFailureRecoveryWaitMs: number;
    isShuttingDown: () => boolean;
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  }): Promise<void> {
    if (params.isShuttingDown()) {
      return;
    }

    const codeText = params.code === null ? 'null' : String(params.code);
    const signalText = params.signal ?? 'null';
    this.logger.error(`Chrome process exited unexpectedly (code=${codeText}, signal=${signalText}).`);

    const cdpStillReachable = await this.isCdpReachableAfterExit(params.cdpHost, params.cdpPort);
    if (cdpStillReachable) {
      this.logger.warn('Chrome launcher process exited, but CDP is still reachable. Continuing without shutting down.');
      return;
    }

    await this.recoverFromFailure({
      reason: 'CDP connection to the browser was lost.',
      cdpHost: params.cdpHost,
      cdpPort: params.cdpPort,
      browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs,
      isShuttingDown: params.isShuttingDown,
      onUnexpectedExit: params.onUnexpectedExit
    });
  }

  async recoverFromFailure(params: {
    reason: string;
    cdpHost: string;
    cdpPort: number;
    browserFailureRecoveryWaitMs: number;
    isShuttingDown: () => boolean;
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  }): Promise<void> {
    if (params.isShuttingDown()) {
      return;
    }

    if (this.recoveryInProgress) {
      this.logger.warn('Browser recovery is already in progress; waiting for the active retry to finish.');
      return;
    }

    this.recoveryInProgress = true;
    const waitSeconds = Math.floor(params.browserFailureRecoveryWaitMs / 1000);

    this.logger.error(`Browser failure detected: ${params.reason}`);
    this.chromiumProcessLifecycleService.stopChromiumProcess();
    await this.chromiumPageSyncService.sleep(1000);
    this.chromiumProcessLifecycleService.forceKillChromiumProcess();
    this.logger.error(
      `Browser will be restarted after waiting ${waitSeconds} seconds.`
    );

    try {
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
    } catch (error) {
      this.logger.error(`Browser restart failed: ${toErrorMessage(error)}`);
    } finally {
      this.recoveryInProgress = false;
    }
  }

  private async isCdpReachableAfterExit(cdpHost: string, cdpPort: number): Promise<boolean> {
    const attempts = 5;
    const waitMs = 250;

    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.chromeConfig.chromeCdpRequestTimeoutMs);
      try {
        const response = await fetch(`http://${cdpHost}:${cdpPort}/json/version`, {
          signal: controller.signal
        });
        if (response.ok) {
          return true;
        }
      } catch {
        // Keep retrying; this is expected while Chrome is transitioning.
      } finally {
        clearTimeout(timer);
      }

      await this.chromiumPageSyncService.sleep(waitMs);
    }

    return false;
  }
}
