import { Module } from '@nestjs/common';
import { UpdatePropertiesController } from 'src/adapters/inbound/http/update-properties.controller';
import { ScraperStateModule } from 'src/application/services/state/scraper-state.module';

@Module({
  imports: [ScraperStateModule],
  controllers: [UpdatePropertiesController]
})
export class UpdatePropertiesHttpModule {}
