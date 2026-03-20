import { Injectable, Logger } from '@nestjs/common';
import type { ScraperStateLoopHandlers } from 'src/application/services/state/scraper-state-loop.service';
import { ProcessScraperStateTransitionUseCase } from 'src/application/usecases/state/process-scraper-state-transition.use-case';
import { sleep } from 'src/infrastructure/sleep';

@Injectable()
export class RunScraperStateLoopCoreUseCase {
  private readonly logger = new Logger(RunScraperStateLoopCoreUseCase.name);
  private readonly idlePollIntervalMs = 500;

  constructor(private readonly processScraperStateTransitionUseCase: ProcessScraperStateTransitionUseCase) {}

  async execute(handlers: ScraperStateLoopHandlers): Promise<void> {
    while (!handlers.isShuttingDown()) {
      const stateTransitionProcessed = await this.processScraperStateTransitionUseCase.execute(handlers);
      if (stateTransitionProcessed) {
        continue;
      }

      await sleep(this.idlePollIntervalMs);
    }

    this.logger.log('Scraper state loop stopped because shutdown was requested.');
  }
}
