import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UpdatePropertiesHttpModule } from 'adapters/inbound/http/update-properties-http.module';
import { OutboundAdaptersModule } from 'adapters/outbound/outbound-adapters.module';
import { ScraperOrchestrationModule } from 'application/services/scraper/scraper-orchestration.module';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';
import { InputOutputModule } from 'infrastructure/input-output/input-output.module';
import { OperatingSystemProcessControlModule } from 'infrastructure/operating-system/operating-system-process-control.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ConfigurationModule,
    InputOutputModule,
    OperatingSystemProcessControlModule,
    OutboundAdaptersModule,
    UpdatePropertiesHttpModule,
    ScraperOrchestrationModule
  ]
})
export class AppModule {}
