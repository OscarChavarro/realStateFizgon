import { Module } from '@nestjs/common';
import { EndpointsBasicAuthGuard } from 'adapters/inbound/http/endpoints-basic-auth.guard';
import { UpdatePropertiesController } from 'adapters/inbound/http/update-properties.controller';
import { ScraperStateModule } from 'application/services/state/scraper-state.module';
import { RequestScrapePropertiesUseCase } from 'application/usecases/state/request-scrape-properties.use-case';
import { RequestUpdatePropertiesUseCase } from 'application/usecases/state/request-update-properties.use-case';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperStateModule],
  controllers: [UpdatePropertiesController],
  providers: [EndpointsBasicAuthGuard, RequestUpdatePropertiesUseCase, RequestScrapePropertiesUseCase]
})
export class UpdatePropertiesHttpModule {}
