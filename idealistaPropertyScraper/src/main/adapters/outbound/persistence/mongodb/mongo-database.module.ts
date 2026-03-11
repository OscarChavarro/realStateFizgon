import { Module } from '@nestjs/common';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { MongoPriceMigrationService } from 'src/adapters/outbound/persistence/mongodb/mongo-price-migration.service';
import { MongoPropertyUpsertService } from 'src/adapters/outbound/persistence/mongodb/mongo-property-upsert.service';
import { MongoPropertyVisitService } from 'src/adapters/outbound/persistence/mongodb/mongo-property-visit.service';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Module({
  imports: [ConfigurationModule],
  providers: [
    MongoPriceMigrationService,
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
