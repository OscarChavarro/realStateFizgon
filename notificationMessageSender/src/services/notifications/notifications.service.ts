import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Configuration } from '../../config/configuration';
import { RabbitMqService } from '../rabbitmq/rabbit-mq.service';
import { WhatsappWhiskeySocketsService } from '../whatsapp/whatsapp-whiskey-sockets.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configuration: Configuration,
    private readonly rabbitMqService: RabbitMqService,
    private readonly whatsappWhiskeySocketsService: WhatsappWhiskeySocketsService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.whatsappWhiskeySocketsService.initialize();
    await this.rabbitMqService.consumeMessages(async (message) => {
      this.logger.log(`Consumed outgoing notification message: ${JSON.stringify(message)}`);
      await this.whatsappWhiskeySocketsService.sendTextMessage(this.buildOutgoingWhatsappText(message));
      await this.sleep(this.configuration.notificationPostMessageSentWaitInMs);
    });
  }

  private buildOutgoingWhatsappText(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message && typeof message === 'object') {
      const typedMessage = message as { type?: unknown; url?: unknown };
      const type = typeof typedMessage.type === 'string' ? typedMessage.type : 'NOTIFICATION';
      const url = typeof typedMessage.url === 'string' ? typedMessage.url : '';
      if (url.length > 0) {
        return `[${type}] ${url}`;
      }
      return JSON.stringify(message);
    }

    return String(message);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
