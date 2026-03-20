import { Module } from '@nestjs/common';
import { MongoDatabaseService } from 'adapters/outbound/persistence/mongodb/mongo-database.service';
import { MongoPriceMigrationService } from 'adapters/outbound/persistence/mongodb/mongo-price-migration.service';
import { MongoPublicationDateMapperService } from 'adapters/outbound/persistence/mongodb/mongo-publication-date-mapper.service';
import { MongoPropertyUpsertService } from 'adapters/outbound/persistence/mongodb/mongo-property-upsert.service';
import { MongoPropertyVisitService } from 'adapters/outbound/persistence/mongodb/mongo-property-visit.service';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';
import { PROPERTY_PERSISTENCE_PORT } from 'ports/outbound/persistence/property-persistence.port.token';

@Module({
  imports: [ConfigurationModule],
  providers: [
    MongoPriceMigrationService,
    MongoPublicationDateMapperService,
    MongoPropertyUpsertService,
    MongoPropertyVisitService,
    MongoDatabaseService,
    {
      provide: PROPERTY_PERSISTENCE_PORT,
      useExisting: MongoDatabaseService
    }
  ],
  exports: [MongoDatabaseService, PROPERTY_PERSISTENCE_PORT]
})
export class MongoDatabaseModule {}
