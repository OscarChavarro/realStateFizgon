import { Inject, Injectable } from '@nestjs/common';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { ScraperOrchestratorService } from 'application/services/scraper/scraper-orchestrator.service';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class HandleScraperBootstrapFailureUseCase {
  constructor(
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly scraperOrchestratorService: ScraperOrchestratorService,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
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
      reason: `Browser startup flow failed. ${this.errorMessagePort.toErrorMessage(params.error)}`,
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
