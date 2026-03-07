import { Module } from '@nestjs/common';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { RabbitMqModule } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, RabbitMqModule],
  providers: [MongoDatabaseService],
  exports: [MongoDatabaseService]
})
export class MongoDatabaseModule {}
