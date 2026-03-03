import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from 'src/config/configuration';
import { MetricsController } from 'src/controllers/metrics.controller';
import { PrometheusMetricsService } from 'src/services/prometheus/prometheus-metrics.service';
import { RabbitMqService } from 'src/services/rabbitmq/rabbit-mq.service';
import { NotificationsService } from 'src/services/notifications/notifications.service';
import { WhatsappMessageFormatter } from 'src/services/whatsapp/whatsapp-message-formatter';
import { WhatsappWhiskeySocketsListenerService } from 'src/services/whatsapp/whatsapp-whiskey-sockets-listener.service';
import { WhatsappWhiskeySocketsService } from 'src/services/whatsapp/whatsapp-whiskey-sockets.service';

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
