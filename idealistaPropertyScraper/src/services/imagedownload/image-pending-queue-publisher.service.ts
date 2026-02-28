import { Injectable, Logger } from '@nestjs/common';
import { RabbitMqService } from '../rabbitmq/rabbit-mq.service';

@Injectable()
export class ImagePendingQueuePublisherService {
  private readonly logger = new Logger(ImagePendingQueuePublisherService.name);
  private static readonly PENDING_IMAGE_URLS_QUEUE = 'pending-image-urls-to-download';

  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async publishPendingImageUrl(url: string, propertyId: string): Promise<void> {
    try {
      await this.rabbitMqService.publishJsonToQueue(ImagePendingQueuePublisherService.PENDING_IMAGE_URLS_QUEUE, {
        url,
        propertyId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed enqueueing pending image URL "${url}" for property "${propertyId}": ${message}`);
    }
  }
}
