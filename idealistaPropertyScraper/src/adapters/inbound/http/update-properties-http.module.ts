import { Module } from '@nestjs/common';
import { EndpointsBasicAuthGuard } from 'src/adapters/inbound/http/endpoints-basic-auth.guard';
import { UpdatePropertiesController } from 'src/adapters/inbound/http/update-properties.controller';
import { ScraperStateModule } from 'src/application/services/state/scraper-state.module';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperStateModule],
  controllers: [UpdatePropertiesController],
  providers: [EndpointsBasicAuthGuard]
})
export class UpdatePropertiesHttpModule {}
