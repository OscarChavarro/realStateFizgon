import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { RecoverFromBrowserFailureUseCase } from 'application/usecases/resilience/recover-from-browser-failure.use-case';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class ChromiumFailureGuardService {
  private readonly logger = new Logger(ChromiumFailureGuardService.name);
  private recoveryInProgress = false;

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    private readonly chromiumPageSyncService: ChromiumPageSyncService,
    private readonly recoverFromBrowserFailureUseCase: RecoverFromBrowserFailureUseCase,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
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

    try {
      await this.recoverFromBrowserFailureUseCase.execute(params);
    } catch (error) {
      this.logger.error(`Browser restart failed: ${this.errorMessagePort.toErrorMessage(error)}`);
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
