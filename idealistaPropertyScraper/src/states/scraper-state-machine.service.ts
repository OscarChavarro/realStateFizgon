import { Injectable, Logger } from '@nestjs/common';
import { ScraperState } from './scraper-state.enum';

@Injectable()
export class ScraperStateMachineService {
  private readonly logger = new Logger(ScraperStateMachineService.name);
  private currentState: ScraperState = ScraperState.SCRAPING_FOR_NEW_PROPERTIES;
  private readonly requestedStateQueue: ScraperState[] = [];

  getCurrentState(): ScraperState {
    return this.currentState;
  }

  enqueueUpdatePropertiesRequest(): number {
    this.requestedStateQueue.push(ScraperState.UPDATING_PROPERTIES);
    this.logger.log(
      `State transition request queued: ${ScraperState.UPDATING_PROPERTIES}. Pending requests: ${this.requestedStateQueue.length}.`
    );
    return this.requestedStateQueue.length;
  }

  finishScrapingForNewPropertiesCycle(): ScraperState {
    this.currentState = ScraperState.IDLE;
    const nextRequestedState = this.requestedStateQueue.shift();
    if (nextRequestedState) {
      this.currentState = nextRequestedState;
    }

    this.logger.log(`Current scraper state after SCRAPING_FOR_NEW_PROPERTIES cycle: ${this.currentState}.`);
    return this.currentState;
  }

  finishUpdatingPropertiesCycle(): ScraperState {
    this.currentState = ScraperState.IDLE;
    this.logger.log(`Current scraper state after UPDATING_PROPERTIES cycle: ${this.currentState}.`);
    return this.currentState;
  }

  setState(state: ScraperState): void {
    this.currentState = state;
    this.logger.log(`Current scraper state set to: ${state}.`);
  }

  getPendingRequestsCount(): number {
    return this.requestedStateQueue.length;
  }
}

