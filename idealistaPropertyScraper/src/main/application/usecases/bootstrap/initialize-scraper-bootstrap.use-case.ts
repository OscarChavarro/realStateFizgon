import { Injectable } from '@nestjs/common';
import { HomeSearchPreparationFlowService } from 'src/application/services/bootstrap/home-search-preparation-flow.service';
import { ScraperOrchestratorService } from 'src/application/services/scraper/scraper-orchestrator.service';
import { BootstrapChromiumSessionUseCase } from 'src/application/usecases/bootstrap/bootstrap-chromium-session.use-case';
import { HandleScraperBootstrapFailureUseCase } from 'src/application/usecases/bootstrap/handle-scraper-bootstrap-failure.use-case';
import { RunStartupPreChecksUseCase } from 'src/application/usecases/prechecks/run-startup-pre-checks.use-case';

@Injectable()
export class InitializeScraperBootstrapUseCase {
  constructor(
    private readonly runStartupPreChecksUseCase: RunStartupPreChecksUseCase,
    private readonly homeSearchPreparationFlowService: HomeSearchPreparationFlowService,
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
      await this.homeSearchPreparationFlowService.execute(params.cdpHost, params.cdpPort);
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
