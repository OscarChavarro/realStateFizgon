import { Inject, Injectable, Logger } from '@nestjs/common';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import { ScraperState } from 'domain/states/scraper-state.enum';
import { SCRAPER_SETTINGS_PORT } from 'ports/outbound/settings/scraper-settings.port.token';
import type { ScraperSettingsPort } from 'ports/outbound/settings/scraper-settings.port';

@Injectable()
export class PromoteIdleToScheduledScrapeUseCase {
  private readonly logger = new Logger(PromoteIdleToScheduledScrapeUseCase.name);

  constructor(
    private readonly scraperStateMachineService: ScraperStateMachineService,
    @Inject(SCRAPER_SETTINGS_PORT)
    private readonly scraperConfig: ScraperSettingsPort
  ) {}

  execute(nowMs: number = Date.now()): boolean {
    if (this.scraperStateMachineService.getCurrentState() !== ScraperState.IDLE) {
      return false;
    }

    const lastIdleReachedAtMs = this.scraperStateMachineService.getLastIdleReachedAtMs();
    if (lastIdleReachedAtMs === null) {
      return false;
    }

    const elapsedMs = nowMs - lastIdleReachedAtMs;
    if (elapsedMs < this.scraperConfig.reScrapeIntervalMs) {
      return false;
    }

    this.scraperStateMachineService.setState(ScraperState.SCRAPING_FOR_NEW_PROPERTIES);
    this.logger.log(
      `Scheduler promoted state from IDLE to SCRAPING_FOR_NEW_PROPERTIES after ${elapsedMs} ms idle.`
    );
    return true;
  }
}
