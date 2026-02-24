import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { MetricsController } from './controllers/metrics.controller';
import { PrometheusMetricsService } from './services/prometheus/prometheus-metrics.service';
import { RabbitMqService } from './services/rabbitmq/rabbit-mq.service';
import { NotificationsService } from './services/notifications/notifications.service';
import { WhatsappMessageFormatter } from './services/whatsapp/whatsapp-message-formatter';
import { WhatsappWhiskeySocketsListenerService } from './services/whatsapp/whatsapp-whiskey-sockets-listener.service';
import { WhatsappWhiskeySocketsService } from './services/whatsapp/whatsapp-whiskey-sockets.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [MetricsController],
  providers: [
    Configuration,
    PrometheusMetricsService,
    RabbitMqService,
    WhatsappMessageFormatter,
    WhatsappWhiskeySocketsService,
    WhatsappWhiskeySocketsListenerService,
    NotificationsService
  ]
})
export class AppModule {}
