import { Module } from '@nestjs/common';
import { EndpointsBasicAuthGuard } from 'src/adapters/inbound/http/endpoints-basic-auth.guard';
import { UpdatePropertiesController } from 'src/adapters/inbound/http/update-properties.controller';
import { ScraperStateModule } from 'src/application/services/state/scraper-state.module';
import { RequestScrapePropertiesUseCase } from 'src/application/usecases/state/request-scrape-properties.use-case';
import { RequestUpdatePropertiesUseCase } from 'src/application/usecases/state/request-update-properties.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, ScraperStateModule],
  controllers: [UpdatePropertiesController],
  providers: [EndpointsBasicAuthGuard, RequestUpdatePropertiesUseCase, RequestScrapePropertiesUseCase]
})
export class UpdatePropertiesHttpModule {}
