import { Inject, Injectable, Logger } from '@nestjs/common';
import { Property } from 'domain/property/property';
import { NEW_PROPERTY_NOTIFICATION_PUBLISHER_PORT } from 'ports/outbound/messaging/new-property-notification-publisher.port.token';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { NewPropertyNotificationPublisherPort } from 'ports/outbound/messaging/new-property-notification-publisher.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class PublishNewPropertyNotificationUseCase {
  private readonly logger = new Logger(PublishNewPropertyNotificationUseCase.name);

  constructor(
    @Inject(NEW_PROPERTY_NOTIFICATION_PUBLISHER_PORT)
    private readonly newPropertyNotificationPublisherPort: NewPropertyNotificationPublisherPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  async execute(property: Property): Promise<void> {
    try {
      await this.newPropertyNotificationPublisherPort.publishNewPropertyNotification({
        url: property.url.value,
        title: property.title
      });
    } catch (error) {
      this.logger.error(
        `Property was stored in MongoDB but notification publish failed for "${property.url.value}". ${this.errorMessagePort.toErrorMessage(error)}`
      );
    }
  }
}
