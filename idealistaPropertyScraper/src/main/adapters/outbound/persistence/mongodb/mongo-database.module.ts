import { Module } from '@nestjs/common';
import { SleepModule } from 'adapters/outbound/timing/sleep.module';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';
import { MongoDatabaseService } from 'adapters/outbound/persistence/mongodb/mongo-database.service';
import { MongoPersistenceHealthService } from 'adapters/outbound/persistence/mongodb/mongo-persistence-health.service';
import { MongoPriceMigrationService } from 'adapters/outbound/persistence/mongodb/mongo-price-migration.service';
import { MongoPublicationDateMapperService } from 'adapters/outbound/persistence/mongodb/mongo-publication-date-mapper.service';
import { MongoPropertiesIndexService } from 'adapters/outbound/persistence/mongodb/mongo-properties-index.service';
import { MongoPropertyUpsertService } from 'adapters/outbound/persistence/mongodb/mongo-property-upsert.service';
import { MongoPropertyVisitService } from 'adapters/outbound/persistence/mongodb/mongo-property-visit.service';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';
import { PERSISTENCE_HEALTH_PORT } from 'ports/outbound/persistence/persistence-health.port.token';
import { PROPERTY_READ_PORT } from 'ports/outbound/persistence/property-read.port.token';
import { PROPERTY_WRITE_PORT } from 'ports/outbound/persistence/property-write.port.token';

@Module({
  imports: [ConfigurationModule, SleepModule],
  providers: [
    MongoPriceMigrationService,
    MongoPublicationDateMapperService,
    MongoPropertyUpsertService,
    MongoPropertyVisitService,
    MongoDatabaseConnectionService,
    MongoPropertiesIndexService,
    MongoPersistenceHealthService,
    MongoDatabaseService,
    {
      provide: PROPERTY_WRITE_PORT,
      useExisting: MongoDatabaseService
    },
    {
      provide: PROPERTY_READ_PORT,
      useExisting: MongoDatabaseService
    },
    {
      provide: PERSISTENCE_HEALTH_PORT,
      useExisting: MongoPersistenceHealthService
    }
  ],
  exports: [MongoDatabaseService, MongoPersistenceHealthService, PROPERTY_WRITE_PORT, PROPERTY_READ_PORT, PERSISTENCE_HEALTH_PORT]
})
export class MongoDatabaseModule {}
