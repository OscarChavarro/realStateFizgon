import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { RabbitMqService } from './services/rabbitmq/rabbit-mq.service';
import { NotificationsService } from './services/notifications/notifications.service';
import { WhatsappMessageFormatter } from './services/whatsapp/whatsapp-message-formatter';
import { WhatsappWhiskeySocketsService } from './services/whatsapp/whatsapp-whiskey-sockets.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [Configuration, RabbitMqService, WhatsappMessageFormatter, WhatsappWhiskeySocketsService, NotificationsService]
})
export class AppModule {}
