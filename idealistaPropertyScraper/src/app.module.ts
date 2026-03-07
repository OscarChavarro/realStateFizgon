import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UpdatePropertiesHttpModule } from 'src/adapters/inbound/http/update-properties-http.module';
import { ScraperOrchestrationModule } from 'src/application/services/scraper/scraper-orchestration.module';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

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
