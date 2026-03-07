import { Module } from '@nestjs/common';
import { RabbitMqService } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.service';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [RabbitMqService],
  exports: [RabbitMqService]
})
export class RabbitMqModule {}
