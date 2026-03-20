import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UpdatePropertiesHttpModule } from 'adapters/inbound/http/update-properties-http.module';
import { ScraperOrchestrationModule } from 'application/services/scraper/scraper-orchestration.module';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ConfigurationModule,
    UpdatePropertiesHttpModule,
    ScraperOrchestrationModule
  ]
})
export class AppModule {}
