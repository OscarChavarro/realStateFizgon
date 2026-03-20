import { Inject, Injectable } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { ScraperStateLoopService } from 'application/services/state/scraper-state-loop.service';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class RunScraperStateLoopUseCase {
  constructor(
    private readonly scraperStateLoopService: ScraperStateLoopService,
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
    this.scraperStateLoopService.start({
      onScrapingForNewProperties: params.onScrapingForNewProperties,
      onUpdatingProperties: params.onUpdatingProperties,
      onLoopError: async (error: unknown) => {
        await this.chromiumFailureGuardService.recoverFromFailure({
          reason: `Scraper state loop failed. ${this.errorMessagePort.toErrorMessage(error)}`,
          cdpHost: params.cdpHost,
          cdpPort: params.cdpPort,
          browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs,
          isShuttingDown: params.isShuttingDown,
          onUnexpectedExit: params.onUnexpectedChromeExit
        });
        params.onAfterRecovery();
      },
      isShuttingDown: params.isShuttingDown
    });
  }
}
