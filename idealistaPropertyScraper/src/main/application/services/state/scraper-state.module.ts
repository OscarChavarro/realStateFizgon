import { Module } from '@nestjs/common';
import { SleepModule } from 'adapters/outbound/timing/sleep.module';
import { ScraperStateLoopService } from 'application/services/state/scraper-state-loop.service';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import { ScheduleService } from 'application/services/state/schedule.service';
import { ProcessScraperStateTransitionUseCase } from 'application/usecases/state/process-scraper-state-transition.use-case';
import { PromoteIdleToScheduledScrapeUseCase } from 'application/usecases/state/promote-idle-to-scheduled-scrape.use-case';
import { ResolveIdleStateUseCase } from 'application/usecases/state/resolve-idle-state.use-case';
import { RunScraperStateLoopCoreUseCase } from 'application/usecases/state/run-scraper-state-loop-core.use-case';

@Module({
  imports: [SleepModule],
  providers: [
    ScraperStateMachineService,
    PromoteIdleToScheduledScrapeUseCase,
    ScheduleService,
    ResolveIdleStateUseCase,
    ProcessScraperStateTransitionUseCase,
    RunScraperStateLoopCoreUseCase,
    ScraperStateLoopService
  ],
  exports: [ScraperStateMachineService, ScheduleService, ScraperStateLoopService]
})
export class ScraperStateModule {}
