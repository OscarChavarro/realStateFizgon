import { Injectable, Logger } from '@nestjs/common';
import type { ScraperStateLoopHandlers } from 'src/application/services/state/scraper-state-loop.service';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { sleep } from 'src/infrastructure/sleep';

@Injectable()
export class RunScraperStateLoopCoreUseCase {
  private readonly logger = new Logger(RunScraperStateLoopCoreUseCase.name);
  private readonly idlePollIntervalMs = 500;

  constructor(
    private readonly scraperStateMachineService: ScraperStateMachineService,
    private readonly scheduleService: ScheduleService
  ) {}

  async execute(handlers: ScraperStateLoopHandlers): Promise<void> {
    while (!handlers.isShuttingDown()) {
      const currentState = this.scraperStateMachineService.getCurrentState();
      if (currentState === ScraperState.SCRAPING_FOR_NEW_PROPERTIES) {
        await handlers.onScrapingForNewProperties();
        this.scraperStateMachineService.finishScrapingForNewPropertiesCycle();
        continue;
      }

      if (currentState === ScraperState.UPDATING_PROPERTIES) {
        await handlers.onUpdatingProperties();
        this.scraperStateMachineService.finishUpdatingPropertiesCycle();
        continue;
      }

      if (currentState === ScraperState.IDLE && this.scraperStateMachineService.getPendingRequestsCount() > 0) {
        const nextRequestedState = this.scraperStateMachineService.consumeNextRequestedState();
        if (nextRequestedState) {
          this.scraperStateMachineService.setState(nextRequestedState);
        }
        continue;
      }

      if (currentState === ScraperState.IDLE && this.scheduleService.promoteIdleToScheduledScrapeIfDue()) {
        continue;
      }

      await sleep(this.idlePollIntervalMs);
    }

    this.logger.log('Scraper state loop stopped because shutdown was requested.');
  }
}
