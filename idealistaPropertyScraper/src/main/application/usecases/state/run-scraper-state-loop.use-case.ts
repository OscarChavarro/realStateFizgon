import { Injectable } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'src/application/services/chromium/chromium-failure-guard.service';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { toErrorMessage } from 'src/infrastructure/error-message';

@Injectable()
export class RunScraperStateLoopUseCase {
  constructor(
    private readonly scraperStateLoopService: ScraperStateLoopService,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService
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
          reason: `Scraper state loop failed. ${toErrorMessage(error)}`,
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
