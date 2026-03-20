import { Inject, Injectable, Logger } from '@nestjs/common';
import { QueuePublisherPort } from 'ports/outbound/messaging/queue-publisher.port';
import { QUEUE_PUBLISHER_PORT } from 'ports/outbound/messaging/queue-publisher.port.token';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

@Injectable()
export class ImagePendingQueuePublisherService {
  private readonly logger = new Logger(ImagePendingQueuePublisherService.name);
  private static readonly PENDING_IMAGE_URLS_QUEUE = 'pending-image-urls-to-download';

  constructor(
    @Inject(QUEUE_PUBLISHER_PORT)
    private readonly queuePublisherPort: QueuePublisherPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  async publishPendingImageUrl(url: string, propertyId: string): Promise<void> {
    try {
      await this.queuePublisherPort.publishJsonToQueue(ImagePendingQueuePublisherService.PENDING_IMAGE_URLS_QUEUE, {
        url,
        propertyId
      });
    } catch (error) {
      const message = this.errorMessagePort.toErrorMessage(error);
      this.logger.error(`Failed enqueueing pending image URL "${url}" for property "${propertyId}": ${message}`);
    }
  }
}
