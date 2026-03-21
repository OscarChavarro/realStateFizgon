import { Inject, Injectable, Logger } from '@nestjs/common';
import { ScraperState } from 'domain/states/scraper-state';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import { CLOCK_PORT } from 'ports/outbound/timing/clock.port.token';

import type { ClockPort } from 'ports/outbound/timing/clock.port';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';

@Injectable()
export class ScraperStateMachineService {
  private readonly logger = new Logger(ScraperStateMachineService.name);
  private readonly maxPendingStateRequests = 10;
  private currentState: ScraperState;
  private lastIdleReachedAtMs: number | null = null;
  private readonly requestedStateQueue: ScraperState[] = [];

  constructor(
    @Inject(SCRAPER_SETTINGS_PORT) private readonly scraperConfig: ScraperSettingsPort,
    @Inject(CLOCK_PORT) private readonly clockPort: ClockPort
  ) {
    this.currentState = scraperConfig.initialScraperState;
    if (this.currentState === ScraperState.IDLE) {
      this.lastIdleReachedAtMs = this.clockPort.nowMs();
    }
    this.logger.log(`Initial scraper state set to: ${this.currentState}.`);
  }

  getCurrentState(): ScraperState {
    return this.currentState;
  }

  getLastIdleReachedAtMs(): number | null {
    return this.lastIdleReachedAtMs;
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
    this.lastIdleReachedAtMs = this.clockPort.nowMs();
    const nextRequestedState = this.requestedStateQueue.shift();
    if (nextRequestedState) {
      this.currentState = nextRequestedState;
    }

    this.logger.log(`Current scraper state after SCRAPING_FOR_NEW_PROPERTIES cycle: ${this.currentState}.`);
    return this.currentState;
  }

  finishUpdatingPropertiesCycle(): ScraperState {
    this.currentState = ScraperState.IDLE;
    this.lastIdleReachedAtMs = this.clockPort.nowMs();
    const nextRequestedState = this.requestedStateQueue.shift();
    if (nextRequestedState) {
      this.currentState = nextRequestedState;
    }

    this.logger.log(`Current scraper state after UPDATING_PROPERTIES cycle: ${this.currentState}.`);
    return this.currentState;
  }

  setState(state: ScraperState): void {
    this.currentState = state;
    if (state === ScraperState.IDLE) {
      this.lastIdleReachedAtMs = this.clockPort.nowMs();
    }
    this.logger.log(`Current scraper state set to: ${state}.`);
  }

  getPendingRequestsCount(): number {
    return this.requestedStateQueue.length;
  }

  consumeNextRequestedState(): ScraperState | undefined {
    return this.requestedStateQueue.shift();
  }
}
