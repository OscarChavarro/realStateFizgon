import { Inject, Injectable, Logger } from '@nestjs/common';
import { Property } from 'src/domain/property/property.model';
import { toErrorMessage } from 'src/infrastructure/error-message';
import { QueuePublisherPort } from 'src/ports/outbound/messaging/queue-publisher.port';
import { QUEUE_PUBLISHER_PORT } from 'src/ports/outbound/messaging/queue-publisher.port.token';

@Injectable()
export class PublishNewPropertyNotificationUseCase {
  private readonly logger = new Logger(PublishNewPropertyNotificationUseCase.name);
  private static readonly OUTGOING_NOTIFICATION_MESSAGES_QUEUE = 'outgoing-notification-messages';

  constructor(
    @Inject(QUEUE_PUBLISHER_PORT)
    private readonly queuePublisherPort: QueuePublisherPort
  ) {}

  async execute(property: Property): Promise<void> {
    try {
      await this.queuePublisherPort.publishJsonToQueue(
        PublishNewPropertyNotificationUseCase.OUTGOING_NOTIFICATION_MESSAGES_QUEUE,
        {
          url: property.url,
          title: property.title,
          type: 'IDEALISTA_UPDATE'
        }
      );
    } catch (error) {
      this.logger.error(
        `Property was stored in MongoDB but notification publish failed for "${property.url}". ${toErrorMessage(error)}`
      );
    }
  }
}
