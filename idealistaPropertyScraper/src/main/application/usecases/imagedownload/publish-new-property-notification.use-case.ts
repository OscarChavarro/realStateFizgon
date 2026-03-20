import { Inject, Injectable, Logger } from '@nestjs/common';
import { Property } from 'domain/property/property.model';
import { QueuePublisherPort } from 'ports/outbound/messaging/queue-publisher.port';
import { QUEUE_PUBLISHER_PORT } from 'ports/outbound/messaging/queue-publisher.port.token';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class PublishNewPropertyNotificationUseCase {
  private readonly logger = new Logger(PublishNewPropertyNotificationUseCase.name);
  private static readonly OUTGOING_NOTIFICATION_MESSAGES_QUEUE = 'outgoing-notification-messages';

  constructor(
    @Inject(QUEUE_PUBLISHER_PORT)
    private readonly queuePublisherPort: QueuePublisherPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
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
        `Property was stored in MongoDB but notification publish failed for "${property.url}". ${this.errorMessagePort.toErrorMessage(error)}`
      );
    }
  }
}
