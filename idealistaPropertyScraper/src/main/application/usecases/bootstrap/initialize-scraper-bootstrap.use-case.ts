import { Injectable } from '@nestjs/common';
import { ScraperOrchestratorService } from 'application/services/scraper/scraper-orchestrator.service';
import { BootstrapChromiumSessionUseCase } from 'application/usecases/bootstrap/bootstrap-chromium-session.use-case';
import { HandleScraperBootstrapFailureUseCase } from 'application/usecases/bootstrap/handle-scraper-bootstrap-failure.use-case';
import { PrepareHomeSearchUseCase } from 'application/usecases/bootstrap/prepare-home-search.use-case';
import { RunStartupPreChecksUseCase } from 'application/usecases/prechecks/run-startup-pre-checks.use-case';

@Injectable()
export class InitializeScraperBootstrapUseCase {
  constructor(
    private readonly runStartupPreChecksUseCase: RunStartupPreChecksUseCase,
    private readonly prepareHomeSearchUseCase: PrepareHomeSearchUseCase,
    private readonly scraperOrchestratorService: ScraperOrchestratorService,
    private readonly bootstrapChromiumSessionUseCase: BootstrapChromiumSessionUseCase,
    private readonly handleScraperBootstrapFailureUseCase: HandleScraperBootstrapFailureUseCase
  ) {}

  async execute(params: {
    cdpHost: string;
    cdpPort: number;
    browserFailureRecoveryWaitMs: number;
    isShuttingDown: () => boolean;
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  }): Promise<void> {
    try {
      await this.runStartupPreChecksUseCase.execute();
      await this.bootstrapChromiumSessionUseCase.execute({
        cdpHost: params.cdpHost,
        cdpPort: params.cdpPort,
        onUnexpectedExit: params.onUnexpectedExit,
        isShuttingDown: params.isShuttingDown
      });
      await this.prepareHomeSearchUseCase.execute(params.cdpHost, params.cdpPort);
      this.startOrchestrator(params);
    } catch (error) {
      await this.handleScraperBootstrapFailureUseCase.execute({
        error,
        cdpHost: params.cdpHost,
        cdpPort: params.cdpPort,
        browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs,
        isShuttingDown: params.isShuttingDown,
        onUnexpectedExit: params.onUnexpectedExit
      });
    }
  }

  private startOrchestrator(params: {
    cdpHost: string;
    cdpPort: number;
    browserFailureRecoveryWaitMs: number;
    isShuttingDown: () => boolean;
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  }): void {
    this.scraperOrchestratorService.start({
      cdpHost: params.cdpHost,
      cdpPort: params.cdpPort,
      isShuttingDown: params.isShuttingDown,
      onUnexpectedChromeExit: params.onUnexpectedExit,
      browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs
    });
  }
}
