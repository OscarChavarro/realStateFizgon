import { Module } from '@nestjs/common';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';
import { ConfigurationModule } from 'src/infrastructure/config/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [ScraperStateMachineService],
  exports: [ScraperStateMachineService]
})
export class ScraperStateModule {}
