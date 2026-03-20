import { Module } from '@nestjs/common';
import { SleepModule } from 'src/adapters/outbound/timing/sleep.module';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { ProcessScraperStateTransitionUseCase } from 'src/application/usecases/state/process-scraper-state-transition.use-case';
import { PromoteIdleToScheduledScrapeUseCase } from 'src/application/usecases/state/promote-idle-to-scheduled-scrape.use-case';
import { ResolveIdleStateUseCase } from 'src/application/usecases/state/resolve-idle-state.use-case';
import { RunScraperStateLoopCoreUseCase } from 'src/application/usecases/state/run-scraper-state-loop-core.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, SleepModule],
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
