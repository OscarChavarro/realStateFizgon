import { Injectable } from '@nestjs/common';
import { RunScraperStateLoopCoreUseCase } from 'src/application/usecases/state/run-scraper-state-loop-core.use-case';

export type ScraperStateLoopHandlers = {
  onScrapingForNewProperties: () => Promise<void>;
  onUpdatingProperties: () => Promise<void>;
  onLoopError: (error: unknown) => Promise<void>;
  isShuttingDown: () => boolean;
};

@Injectable()
export class ScraperStateLoopService {
  private loopRunning = false;

  constructor(private readonly runScraperStateLoopCoreUseCase: RunScraperStateLoopCoreUseCase) {}

  start(handlers: ScraperStateLoopHandlers): void {
    if (this.loopRunning) {
      return;
    }

    this.loopRunning = true;
    void this.runScraperStateLoopCoreUseCase.execute(handlers)
      .catch(async (error) => {
        await handlers.onLoopError(error);
      })
      .finally(() => {
        this.loopRunning = false;
      });
  }
}
