import { Injectable } from '@nestjs/common';
import type { ScraperStateLoopHandlers } from 'application/usecases/state/scraper-state-loop-handlers.port';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import { ResolveIdleStateUseCase } from 'application/usecases/state/resolve-idle-state.use-case';
import { ScraperState } from 'domain/states/scraper-state.enum';

@Injectable()
export class ProcessScraperStateTransitionUseCase {
  constructor(
    private readonly scraperStateMachineService: ScraperStateMachineService,
    private readonly resolveIdleStateUseCase: ResolveIdleStateUseCase
  ) {}

  async execute(handlers: ScraperStateLoopHandlers): Promise<boolean> {
    const currentState = this.scraperStateMachineService.getCurrentState();
    if (currentState === ScraperState.SCRAPING_FOR_NEW_PROPERTIES) {
      await handlers.onScrapingForNewProperties();
      this.scraperStateMachineService.finishScrapingForNewPropertiesCycle();
      return true;
    }

    if (currentState === ScraperState.UPDATING_PROPERTIES) {
      await handlers.onUpdatingProperties();
      this.scraperStateMachineService.finishUpdatingPropertiesCycle();
      return true;
    }

    if (currentState === ScraperState.IDLE) {
      return this.resolveIdleStateUseCase.execute();
    }

    return false;
  }
}
