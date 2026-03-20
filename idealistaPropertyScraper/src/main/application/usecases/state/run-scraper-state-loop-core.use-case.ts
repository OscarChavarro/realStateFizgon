import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ScraperStateLoopHandlers } from 'application/usecases/state/scraper-state-loop-handlers.port';
import { ProcessScraperStateTransitionUseCase } from 'application/usecases/state/process-scraper-state-transition.use-case';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { SleepPort } from 'ports/outbound/timing/sleep.port';

@Injectable()
export class RunScraperStateLoopCoreUseCase {
  private readonly logger = new Logger(RunScraperStateLoopCoreUseCase.name);
  private readonly idlePollIntervalMs = 500;

  constructor(
    private readonly processScraperStateTransitionUseCase: ProcessScraperStateTransitionUseCase,
    @Inject(SLEEP_PORT) private readonly sleepPort: SleepPort
  ) {}

  async execute(handlers: ScraperStateLoopHandlers): Promise<void> {
    while (!handlers.isShuttingDown()) {
      const stateTransitionProcessed = await this.processScraperStateTransitionUseCase.execute(handlers);
      if (stateTransitionProcessed) {
        continue;
      }

      await this.sleepPort.sleep(this.idlePollIntervalMs);
    }

    this.logger.log('Scraper state loop stopped because shutdown was requested.');
  }
}
