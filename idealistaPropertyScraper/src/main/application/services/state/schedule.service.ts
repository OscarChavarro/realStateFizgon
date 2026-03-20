import { Injectable } from '@nestjs/common';
import { PromoteIdleToScheduledScrapeUseCase } from 'application/usecases/state/promote-idle-to-scheduled-scrape.use-case';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly promoteIdleToScheduledScrapeUseCase: PromoteIdleToScheduledScrapeUseCase
  ) {}

  promoteIdleToScheduledScrapeIfDue(nowMs?: number): boolean {
    return this.promoteIdleToScheduledScrapeUseCase.execute(nowMs);
  }
}
