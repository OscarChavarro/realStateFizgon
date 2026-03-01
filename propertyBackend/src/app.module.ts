import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { FixDatabaseController } from './controllers/fix-database.controller';
import { PropertiesController } from './controllers/properties.controller';
import { RemoveDanglingImagesController } from './controllers/remove-dangling-images.controller';
import { PropertiesUpdatesGateway } from './gateways/properties-updates.gateway';
import { DanglingImagesCleanupService } from './services/datamaintenance/dangling-images-cleanup.service';
import { FileSystemOperationsService } from './services/datamaintenance/file-system-operations.service';
import { PriceFixer } from './services/datamaintenance/price-fixer.service';
import { PropertyImagesDatabaseCleanupService } from './services/datamaintenance/property-images-database-cleanup.service';
import { MongoDatabaseService } from './services/mongo-database.service';
import { MongoRepository } from './services/mongo.repository';
import { PropertiesMonitorService } from './services/properties-monitor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [
    PropertiesController,
    FixDatabaseController,
    RemoveDanglingImagesController
  ],
  providers: [
    Configuration,
    MongoDatabaseService,
    MongoRepository,
    PriceFixer,
    FileSystemOperationsService,
    PropertyImagesDatabaseCleanupService,
    DanglingImagesCleanupService,
    PropertiesUpdatesGateway,
    PropertiesMonitorService
  ]
})
export class AppModule {}
