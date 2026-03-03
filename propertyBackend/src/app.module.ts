import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from 'src/config/configuration';
import { FixDatabaseController } from 'src/controllers/fix-database.controller';
import { PropertiesController } from 'src/controllers/properties.controller';
import { RemoveDanglingImagesController } from 'src/controllers/remove-dangling-images.controller';
import { PropertiesUpdatesGateway } from 'src/gateways/properties-updates.gateway';
import { DanglingImagesCleanupService } from 'src/services/datamaintenance/dangling-images-cleanup.service';
import { FileSystemOperationsService } from 'src/services/datamaintenance/file-system-operations.service';
import { PriceFixer } from 'src/services/datamaintenance/price-fixer.service';
import { PropertyImagesDatabaseCleanupService } from 'src/services/datamaintenance/property-images-database-cleanup.service';
import { MongoDatabaseService } from 'src/services/mongo-database.service';
import { MongoRepository } from 'src/services/mongo.repository';
import { PropertiesMonitorService } from 'src/services/properties-monitor.service';

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
