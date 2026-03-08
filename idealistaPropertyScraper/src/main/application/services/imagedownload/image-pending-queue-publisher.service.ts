import { Inject, Injectable, Logger } from '@nestjs/common';
import { toErrorMessage } from 'src/infrastructure/error-message';
import { QueuePublisherPort } from 'src/ports/outbound/messaging/queue-publisher.port';
import { QUEUE_PUBLISHER_PORT } from 'src/ports/outbound/messaging/queue-publisher.port.token';

@Injectable()
export class ImagePendingQueuePublisherService {
  private readonly logger = new Logger(ImagePendingQueuePublisherService.name);
  private static readonly PENDING_IMAGE_URLS_QUEUE = 'pending-image-urls-to-download';

  constructor(
    @Inject(QUEUE_PUBLISHER_PORT)
    private readonly queuePublisherPort: QueuePublisherPort
  ) {}

  async publishPendingImageUrl(url: string, propertyId: string): Promise<void> {
    try {
      await this.queuePublisherPort.publishJsonToQueue(ImagePendingQueuePublisherService.PENDING_IMAGE_URLS_QUEUE, {
        url,
        propertyId
      });
    } catch (error) {
      const message = toErrorMessage(error);
      this.logger.error(`Failed enqueueing pending image URL "${url}" for property "${propertyId}": ${message}`);
    }
  }
}
