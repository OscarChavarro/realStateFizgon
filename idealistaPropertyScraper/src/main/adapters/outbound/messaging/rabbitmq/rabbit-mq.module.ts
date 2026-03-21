import { Module } from '@nestjs/common';
import { RabbitMqService } from 'adapters/outbound/messaging/rabbitmq/rabbit-mq.service';
import { ConfigurationModule } from 'infrastructure/config/settings/configuration.module';
import { NEW_PROPERTY_NOTIFICATION_PUBLISHER_PORT } from 'ports/outbound/messaging/new-property-notification-publisher.port.token';
import { PENDING_IMAGE_URL_PUBLISHER_PORT } from 'ports/outbound/messaging/pending-image-url-publisher.port.token';

@Module({
  imports: [ConfigurationModule],
  providers: [
    RabbitMqService,
    {
      provide: NEW_PROPERTY_NOTIFICATION_PUBLISHER_PORT,
      useExisting: RabbitMqService
    },
    {
      provide: PENDING_IMAGE_URL_PUBLISHER_PORT,
      useExisting: RabbitMqService
    }
  ],
  exports: [
    RabbitMqService,
    NEW_PROPERTY_NOTIFICATION_PUBLISHER_PORT,
    PENDING_IMAGE_URL_PUBLISHER_PORT
  ]
})
export class RabbitMqModule {}
