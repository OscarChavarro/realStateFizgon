import { Module } from '@nestjs/common';
import { MongoDatabaseService } from 'adapters/outbound/persistence/mongodb/mongo-database.service';
import { MongoPriceMigrationService } from 'adapters/outbound/persistence/mongodb/mongo-price-migration.service';
import { MongoPublicationDateMapperService } from 'adapters/outbound/persistence/mongodb/mongo-publication-date-mapper.service';
import { MongoPropertyUpsertService } from 'adapters/outbound/persistence/mongodb/mongo-property-upsert.service';
import { MongoPropertyVisitService } from 'adapters/outbound/persistence/mongodb/mongo-property-visit.service';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';
import { PERSISTENCE_HEALTH_PORT } from 'ports/outbound/persistence/persistence-health.port.token';
import { PROPERTY_READ_PORT } from 'ports/outbound/persistence/property-read.port.token';
import { PROPERTY_WRITE_PORT } from 'ports/outbound/persistence/property-write.port.token';

@Module({
  imports: [ConfigurationModule],
  providers: [
    MongoPriceMigrationService,
    MongoPublicationDateMapperService,
    MongoPropertyUpsertService,
    MongoPropertyVisitService,
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
      useExisting: MongoDatabaseService
    }
  ],
  exports: [MongoDatabaseService, PROPERTY_WRITE_PORT, PROPERTY_READ_PORT, PERSISTENCE_HEALTH_PORT]
})
export class MongoDatabaseModule {}
