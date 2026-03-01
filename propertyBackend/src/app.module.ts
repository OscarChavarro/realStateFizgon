import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { PropertiesController } from './controllers/properties.controller';
import { PropertiesUpdatesGateway } from './gateways/properties-updates.gateway';
import { MongoDatabaseService } from './services/mongo-database.service';
import { PropertiesMonitorService } from './services/properties-monitor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [PropertiesController],
  providers: [
    Configuration,
    MongoDatabaseService,
    PropertiesUpdatesGateway,
    PropertiesMonitorService
  ]
})
export class AppModule {}
