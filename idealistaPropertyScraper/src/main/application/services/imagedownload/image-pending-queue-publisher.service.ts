import { Inject, Injectable, Logger } from '@nestjs/common';
import { PENDING_IMAGE_URL_PUBLISHER_PORT } from 'ports/outbound/messaging/pending-image-url-publisher.port.token';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { PendingImageUrlPublisherPort } from 'ports/outbound/messaging/pending-image-url-publisher.port';

@Injectable()
export class ImagePendingQueuePublisherService {
  private readonly logger = new Logger(ImagePendingQueuePublisherService.name);

  constructor(
    @Inject(PENDING_IMAGE_URL_PUBLISHER_PORT)
    private readonly pendingImageUrlPublisherPort: PendingImageUrlPublisherPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  async publishPendingImageUrl(url: string, propertyId: string): Promise<void> {
    try {
      await this.pendingImageUrlPublisherPort.publishPendingImageUrl({
        url,
        propertyId
      });
    } catch (error) {
      const message = this.errorMessagePort.toErrorMessage(error);
      this.logger.error(`Failed enqueueing pending image URL "${url}" for property "${propertyId}": ${message}`);
    }
  }
}
