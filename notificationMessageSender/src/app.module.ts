import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { RabbitMqService } from './services/rabbitmq/rabbit-mq.service';
import { NotificationsService } from './services/notifications/notifications.service';
import { WhatsappWhiskeySocketsService } from './services/whatsapp/whatsapp-whiskey-sockets.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [Configuration, RabbitMqService, WhatsappWhiskeySocketsService, NotificationsService]
})
export class AppModule {}
