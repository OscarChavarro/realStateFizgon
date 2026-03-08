import { Module } from '@nestjs/common';
import { RabbitMqService } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.service';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';
import { QUEUE_PUBLISHER_PORT } from 'src/ports/outbound/messaging/queue-publisher.port.token';

@Module({
  imports: [ConfigurationModule],
  providers: [
    RabbitMqService,
    {
      provide: QUEUE_PUBLISHER_PORT,
      useExisting: RabbitMqService
    }
  ],
  exports: [RabbitMqService, QUEUE_PUBLISHER_PORT]
})
export class RabbitMqModule {}
