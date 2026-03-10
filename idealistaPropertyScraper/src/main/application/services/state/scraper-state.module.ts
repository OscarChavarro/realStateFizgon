import { Module } from '@nestjs/common';
import { ScraperStateLoopService } from 'src/application/services/state/scraper-state-loop.service';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ScheduleService } from 'src/application/services/state/schedule.service';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [ScraperStateMachineService, ScheduleService, ScraperStateLoopService],
  exports: [ScraperStateMachineService, ScheduleService, ScraperStateLoopService]
})
export class ScraperStateModule {}
