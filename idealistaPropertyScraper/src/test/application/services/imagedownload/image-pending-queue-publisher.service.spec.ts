import { describe, expect, it, jest } from '@jest/globals';
import { ImagePendingQueuePublisherService } from 'application/services/imagedownload/image-pending-queue-publisher.service';
import { QueuePublisherPort } from 'ports/outbound/messaging/queue-publisher.port';
import { QueuePublisherPortMock } from '../../../ports/outbound/messaging/queue-publisher-port.mock';

class NestLoggerMock {
  readonly error = jest.fn<(message: string) => void>();
}

describe('ImagePendingQueuePublisherService', () => {
  it('whenQueuePublishSucceeds_publishPendingImageUrl_shouldSendPayloadToPendingQueue', async () => {
    // Arrange
    const queuePublisher = new QueuePublisherPortMock();
    queuePublisher.publishJsonToQueue.mockResolvedValue(undefined);
    const service = new ImagePendingQueuePublisherService(queuePublisher as unknown as QueuePublisherPort);
    (service as unknown as { logger: NestLoggerMock }).logger = new NestLoggerMock();
    // Action
    await service.publishPendingImageUrl('https://img4.idealista.com/a.jpg', '123');
    // Assert
    expect(queuePublisher.publishJsonToQueue).toHaveBeenCalledWith('pending-image-urls-to-download', {
      url: 'https://img4.idealista.com/a.jpg',
      propertyId: '123'
    });
  });

  it('whenQueuePublishFails_publishPendingImageUrl_shouldSwallowErrorWithoutThrowing', async () => {
    // Arrange
    const queuePublisher = new QueuePublisherPortMock();
    queuePublisher.publishJsonToQueue.mockRejectedValue(new Error('broker error'));
    const service = new ImagePendingQueuePublisherService(queuePublisher as unknown as QueuePublisherPort);
    const logger = new NestLoggerMock();
    (service as unknown as { logger: NestLoggerMock }).logger = logger;
    // Action
    const action = service.publishPendingImageUrl('https://img4.idealista.com/a.jpg', '123');
    // Assert
    await expect(action).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
