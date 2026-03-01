import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { FixDatabaseController } from './controllers/fix-database.controller';
import { PropertiesController } from './controllers/properties.controller';
import { PropertiesUpdatesGateway } from './gateways/properties-updates.gateway';
import { PriceFixer } from './services/datamaintenance/price-fixer.service';
import { MongoDatabaseService } from './services/mongo-database.service';
import { PropertiesMonitorService } from './services/properties-monitor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [
    PropertiesController,
    FixDatabaseController
  ],
  providers: [
    Configuration,
    MongoDatabaseService,
    PriceFixer,
    PropertiesUpdatesGateway,
    PropertiesMonitorService
  ]
})
export class AppModule {}
