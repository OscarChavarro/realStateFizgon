import { Injectable, Logger } from '@nestjs/common';
import { Configuration } from '../../config/configuration';
import { ChromiumPageSyncService } from './chromium-page-sync.service';

@Injectable()
export class ChromiumFailureGuardService {
  private readonly logger = new Logger(ChromiumFailureGuardService.name);
  private debugHoldInProgress = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly chromiumPageSyncService: ChromiumPageSyncService
  ) {}

  async handleUnexpectedChromeExit(params: {
    code: number | null;
    signal: NodeJS.Signals | null;
    cdpHost: string;
    cdpPort: number;
    browserFailureHoldMs: number;
    isShuttingDown: () => boolean;
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

    await this.holdForDebug('CDP connection to the browser was lost.', params.browserFailureHoldMs, params.isShuttingDown);
  }

  async holdForDebug(reason: string, browserFailureHoldMs: number, isShuttingDown: () => boolean): Promise<void> {
    if (isShuttingDown()) {
      return;
    }

    if (this.debugHoldInProgress) {
      this.logger.warn('Debug hold is already active; keeping current hold window.');
      return;
    }

    this.debugHoldInProgress = true;
    const waitSeconds = Math.floor(browserFailureHoldMs / 1000);

    this.logger.error(`Browser failure detected: ${reason}`);
    this.logger.error(
      `Keeping microservice alive for ${waitSeconds} seconds so the pod can be inspected.`
    );

    try {
      await this.chromiumPageSyncService.sleep(browserFailureHoldMs);
    } finally {
      this.debugHoldInProgress = false;
      this.logger.warn('Debug hold finished. Browser automation is still stopped.');
    }
  }

  private async isCdpReachableAfterExit(cdpHost: string, cdpPort: number): Promise<boolean> {
    const attempts = 5;
    const waitMs = 250;

    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.configuration.chromeCdpRequestTimeoutMs);
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

