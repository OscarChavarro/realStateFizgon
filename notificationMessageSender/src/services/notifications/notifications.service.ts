import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Configuration } from '../../config/configuration';
import { RabbitMqService } from '../rabbitmq/rabbit-mq.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configuration: Configuration,
    private readonly rabbitMqService: RabbitMqService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consumeMessages(async (message) => {
      this.logger.log(`Consumed outgoing notification message: ${JSON.stringify(message)}`);
      await this.sleep(this.configuration.notificationPostMessageSentWaitInMs);
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
