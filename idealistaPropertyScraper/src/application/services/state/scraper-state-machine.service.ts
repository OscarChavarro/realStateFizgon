import { Injectable, Logger } from '@nestjs/common';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { Configuration } from 'src/infrastructure/config/configuration';

@Injectable()
export class ScraperStateMachineService {
  private readonly logger = new Logger(ScraperStateMachineService.name);
  private currentState: ScraperState;
  private readonly requestedStateQueue: ScraperState[] = [];

  constructor(private readonly configuration: Configuration) {
    this.currentState = configuration.initialScraperState;
    this.logger.log(`Initial scraper state set to: ${this.currentState}.`);
  }

  getCurrentState(): ScraperState {
    return this.currentState;
  }

  enqueueUpdatePropertiesRequest(): number {
    return this.enqueueStateRequest(ScraperState.UPDATING_PROPERTIES);
  }

  enqueueScrapePropertiesRequest(): number {
    return this.enqueueStateRequest(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
  }

  private enqueueStateRequest(state: ScraperState): number {
    this.requestedStateQueue.push(state);
    this.logger.log(
      `State transition request queued: ${state}. Pending requests: ${this.requestedStateQueue.length}.`
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
    const nextRequestedState = this.requestedStateQueue.shift();
    if (nextRequestedState) {
      this.currentState = nextRequestedState;
    }

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

  consumeNextRequestedState(): ScraperState | undefined {
    return this.requestedStateQueue.shift();
  }
}
