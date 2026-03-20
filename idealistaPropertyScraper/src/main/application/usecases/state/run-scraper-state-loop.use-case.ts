import { Inject, Injectable } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { RunScraperStateLoopCoreUseCase } from 'application/usecases/state/run-scraper-state-loop-core.use-case';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class RunScraperStateLoopUseCase {
  private loopRunning = false;

  constructor(
    private readonly runScraperStateLoopCoreUseCase: RunScraperStateLoopCoreUseCase,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  execute(params: {
    cdpHost: string;
    cdpPort: number;
    isShuttingDown: () => boolean;
    onUnexpectedChromeExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    browserFailureRecoveryWaitMs: number;
    onScrapingForNewProperties: () => Promise<void>;
    onUpdatingProperties: () => Promise<void>;
    onAfterRecovery: () => void;
  }): void {
    if (this.loopRunning) {
      return;
    }

    this.loopRunning = true;
    void this.runScraperStateLoopCoreUseCase.execute({
      onScrapingForNewProperties: params.onScrapingForNewProperties,
      onUpdatingProperties: params.onUpdatingProperties,
      isShuttingDown: params.isShuttingDown
    })
      .catch(async (error: unknown) => {
        try {
          await this.chromiumFailureGuardService.recoverFromFailure({
            reason: `Scraper state loop failed. ${this.errorMessagePort.toErrorMessage(error)}`,
            cdpHost: params.cdpHost,
            cdpPort: params.cdpPort,
            browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs,
            isShuttingDown: params.isShuttingDown,
            onUnexpectedExit: params.onUnexpectedChromeExit
          });
          params.onAfterRecovery();
        } catch {
          // ChromiumFailureGuardService already logs recovery failures.
        }
      })
      .finally(() => {
        this.loopRunning = false;
      });
  }
}
