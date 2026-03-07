import { Injectable, Logger } from '@nestjs/common';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { ScraperConfig } from 'src/infrastructure/config/scraper.config';

@Injectable()
export class ScraperStateMachineService {
  private readonly logger = new Logger(ScraperStateMachineService.name);
  private readonly maxPendingStateRequests = 10;
  private currentState: ScraperState;
  private readonly requestedStateQueue: ScraperState[] = [];

  constructor(private readonly scraperConfig: ScraperConfig) {
    this.currentState = scraperConfig.initialScraperState;
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
    const existingIndex = this.requestedStateQueue.indexOf(state);
    if (existingIndex >= 0) {
      const isAlreadyLatest = existingIndex === this.requestedStateQueue.length - 1;
      if (!isAlreadyLatest) {
        this.requestedStateQueue.splice(existingIndex, 1);
        this.requestedStateQueue.push(state);
      }

      this.logger.log(
        `State transition request coalesced: ${state}. Pending requests: ${this.requestedStateQueue.length}.`
      );
      return this.requestedStateQueue.length;
    }

    if (this.requestedStateQueue.length >= this.maxPendingStateRequests) {
      const droppedState = this.requestedStateQueue.shift();
      if (droppedState) {
        this.logger.warn(
          `Pending state queue reached limit (${this.maxPendingStateRequests}). Dropping oldest request: ${droppedState}.`
        );
      }
    }

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
