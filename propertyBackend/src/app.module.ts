import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from 'src/infrastructure/config/configuration';
import { FixDatabaseController } from 'src/adapters/inbound/http/fix-database.controller';
import { PropertiesController } from 'src/adapters/inbound/http/properties.controller';
import { RemoveDanglingImagesController } from 'src/adapters/inbound/http/remove-dangling-images.controller';
import { PropertiesUpdatesGateway } from 'src/adapters/inbound/websocket/properties-updates.gateway';
import { DanglingImagesCleanupService } from 'src/application/services/datamaintenance/dangling-images-cleanup.service';
import { FileSystemOperationsService } from 'src/adapters/outbound/filesystem/file-system-operations.service';
import { PriceFixer } from 'src/application/services/datamaintenance/price-fixer.service';
import { PropertyImagesDatabaseCleanupService } from 'src/application/services/datamaintenance/property-images-database-cleanup.service';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { MongoRepository } from 'src/adapters/outbound/persistence/mongodb/mongo.repository';
import { PropertiesMonitorService } from 'src/application/services/properties-monitor.service';

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
