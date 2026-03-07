import { Injectable, Logger } from '@nestjs/common';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScraperState } from 'src/domain/states/scraper-state.enum';

type ScraperStateLoopHandlers = {
  onScrapingForNewProperties: () => Promise<void>;
  onUpdatingProperties: () => Promise<void>;
  onLoopError: (error: unknown) => Promise<void>;
  isShuttingDown: () => boolean;
};

@Injectable()
export class ScraperStateLoopService {
  private readonly logger = new Logger(ScraperStateLoopService.name);
  private readonly idlePollIntervalMs = 500;
  private loopRunning = false;

  constructor(
    private readonly scraperStateMachineService: ScraperStateMachineService
  ) {}

  start(handlers: ScraperStateLoopHandlers): void {
    if (this.loopRunning) {
      return;
    }

    this.loopRunning = true;
    void this.runLoop(handlers)
      .catch(async (error) => {
        await handlers.onLoopError(error);
      })
      .finally(() => {
        this.loopRunning = false;
      });
  }

  private async runLoop(handlers: ScraperStateLoopHandlers): Promise<void> {
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

      await this.sleep(this.idlePollIntervalMs);
    }

    this.logger.log('Scraper state loop stopped because shutdown was requested.');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
