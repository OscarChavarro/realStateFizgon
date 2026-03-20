import { Injectable } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'src/application/services/chromium/chromium-failure-guard.service';
import { ScraperOrchestratorService } from 'src/application/services/scraper/scraper-orchestrator.service';
import { toErrorMessage } from 'src/infrastructure/error-message';

@Injectable()
export class HandleScraperBootstrapFailureUseCase {
  constructor(
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly scraperOrchestratorService: ScraperOrchestratorService
  ) {}

  async execute(params: {
    error: unknown;
    cdpHost: string;
    cdpPort: number;
    browserFailureRecoveryWaitMs: number;
    isShuttingDown: () => boolean;
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  }): Promise<void> {
    await this.chromiumFailureGuardService.recoverFromFailure({
      reason: `Browser startup flow failed. ${toErrorMessage(params.error)}`,
      cdpHost: params.cdpHost,
      cdpPort: params.cdpPort,
      browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs,
      isShuttingDown: params.isShuttingDown,
      onUnexpectedExit: params.onUnexpectedExit
    });

    if (params.isShuttingDown()) {
      return;
    }

    this.scraperOrchestratorService.start({
      cdpHost: params.cdpHost,
      cdpPort: params.cdpPort,
      isShuttingDown: params.isShuttingDown,
      onUnexpectedChromeExit: params.onUnexpectedExit,
      browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs
    });
  }
}
