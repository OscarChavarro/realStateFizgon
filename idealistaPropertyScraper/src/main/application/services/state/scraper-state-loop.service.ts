import { Injectable } from '@nestjs/common';
import type { ScraperStateLoopHandlers } from 'src/application/usecases/state/scraper-state-loop-handlers.port';
import { RunScraperStateLoopCoreUseCase } from 'src/application/usecases/state/run-scraper-state-loop-core.use-case';

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
