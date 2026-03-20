import { Injectable, Logger } from '@nestjs/common';
import { ExecuteScrapeNewPropertiesCycleUseCase } from 'src/application/usecases/chromium/execute-scrape-new-properties-cycle.use-case';
import { ExecuteUpdateExistingPropertiesCycleUseCase } from 'src/application/usecases/chromium/execute-update-existing-properties-cycle.use-case';
import { RunScraperStateLoopUseCase } from 'src/application/usecases/state/run-scraper-state-loop.use-case';

@Injectable()
export class ScraperOrchestratorService {
  private readonly logger = new Logger(ScraperOrchestratorService.name);
  private loopRestartScheduled = false;

  constructor(
    private readonly executeScrapeNewPropertiesCycleUseCase: ExecuteScrapeNewPropertiesCycleUseCase,
    private readonly executeUpdateExistingPropertiesCycleUseCase: ExecuteUpdateExistingPropertiesCycleUseCase,
    private readonly runScraperStateLoopUseCase: RunScraperStateLoopUseCase
  ) {}

  start(params: {
    cdpHost: string;
    cdpPort: number;
    isShuttingDown: () => boolean;
    onUnexpectedChromeExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    browserFailureRecoveryWaitMs: number;
  }): void {
    this.runScraperStateLoopUseCase.execute({
      cdpHost: params.cdpHost,
      cdpPort: params.cdpPort,
      isShuttingDown: params.isShuttingDown,
      onUnexpectedChromeExit: params.onUnexpectedChromeExit,
      browserFailureRecoveryWaitMs: params.browserFailureRecoveryWaitMs,
      onScrapingForNewProperties: async () => this.runScrapeNewPropertiesCycle(params.cdpHost, params.cdpPort),
      onUpdatingProperties: async () => this.runUpdateExistingPropertiesCycle(params.cdpHost, params.cdpPort),
      onAfterRecovery: () => this.scheduleLoopRestart(params)
    });
  }

  private scheduleLoopRestart(params: {
    cdpHost: string;
    cdpPort: number;
    isShuttingDown: () => boolean;
    onUnexpectedChromeExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    browserFailureRecoveryWaitMs: number;
  }): void {
    if (params.isShuttingDown()) {
      return;
    }

    if (this.loopRestartScheduled) {
      return;
    }

    this.loopRestartScheduled = true;
    setTimeout(() => {
      this.loopRestartScheduled = false;
      if (params.isShuttingDown()) {
        return;
      }
      this.start(params);
    }, 0);
  }

  private async runScrapeNewPropertiesCycle(cdpHost: string, cdpPort: number): Promise<void> {
    await this.executeScrapeNewPropertiesCycleUseCase.execute(cdpHost, cdpPort);
  }

  private async runUpdateExistingPropertiesCycle(cdpHost: string, cdpPort: number): Promise<void> {
    await this.executeUpdateExistingPropertiesCycleUseCase.execute(cdpHost, cdpPort);
  }
}
