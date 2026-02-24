import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Configuration } from '../../config/configuration';
import { PrometheusMetricsService } from '../prometheus/prometheus-metrics.service';
import { RabbitMqService } from '../rabbitmq/rabbit-mq.service';
import { WhatsappMessageFormatter } from '../whatsapp/whatsapp-message-formatter';
import { WhatsappWhiskeySocketsListenerService } from '../whatsapp/whatsapp-whiskey-sockets-listener.service';
import { WhatsappWhiskeySocketsService } from '../whatsapp/whatsapp-whiskey-sockets.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configuration: Configuration,
    private readonly prometheusMetricsService: PrometheusMetricsService,
    private readonly rabbitMqService: RabbitMqService,
    private readonly whatsappMessageFormatter: WhatsappMessageFormatter,
    private readonly whatsappWhiskeySocketsListenerService: WhatsappWhiskeySocketsListenerService,
    private readonly whatsappWhiskeySocketsService: WhatsappWhiskeySocketsService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.whatsappWhiskeySocketsService.initialize();
    await this.rabbitMqService.consumeMessages(async (message) => {
      this.logger.log(`Consumed outgoing notification message: ${JSON.stringify(message)}`);
      await this.whatsappWhiskeySocketsService.sendTextMessage(this.whatsappMessageFormatter.format(message));
      this.prometheusMetricsService.incrementWhatsappMessagesSentSuccess();
      await this.sleep(this.configuration.notificationPostMessageSentWaitInMs);
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
