import { Injectable } from '@nestjs/common';
import { ScheduleService } from 'application/services/state/schedule.service';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';

@Injectable()
export class ResolveIdleStateUseCase {
  constructor(
    private readonly scraperStateMachineService: ScraperStateMachineService,
    private readonly scheduleService: ScheduleService
  ) {}

  execute(): boolean {
    if (this.scraperStateMachineService.getPendingRequestsCount() > 0) {
      const nextRequestedState = this.scraperStateMachineService.consumeNextRequestedState();
      if (nextRequestedState) {
        this.scraperStateMachineService.setState(nextRequestedState);
      }
      return true;
    }

    if (this.scheduleService.promoteIdleToScheduledScrapeIfDue()) {
      return true;
    }

    return false;
  }
}
