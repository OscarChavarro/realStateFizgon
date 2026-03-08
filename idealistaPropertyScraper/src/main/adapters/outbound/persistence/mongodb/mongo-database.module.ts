import { Module } from '@nestjs/common';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { RabbitMqModule } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Module({
  imports: [ConfigurationModule, RabbitMqModule],
  providers: [
    MongoDatabaseService,
    {
      provide: PROPERTY_PERSISTENCE_PORT,
      useExisting: MongoDatabaseService
    }
  ],
  exports: [MongoDatabaseService, PROPERTY_PERSISTENCE_PORT]
})
export class MongoDatabaseModule {}
