import { describe, expect, it, jest } from '@jest/globals';
import { RabbitMqService } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.service';
import { ImagePendingQueuePublisherService } from 'src/application/services/imagedownload/image-pending-queue-publisher.service';

class RabbitMqServiceMockForPendingQueue {
  readonly publishJsonToQueue = jest.fn<(queue: string, payload: unknown) => Promise<void>>();
}

class NestLoggerMock {
  readonly error = jest.fn<(message: string) => void>();
}

describe('ImagePendingQueuePublisherService', () => {
  it('whenQueuePublishSucceeds_publishPendingImageUrl_shouldSendPayloadToPendingQueue', async () => {
    // Arrange
    const rabbit = new RabbitMqServiceMockForPendingQueue();
    rabbit.publishJsonToQueue.mockResolvedValue(undefined);
    const service = new ImagePendingQueuePublisherService(rabbit as unknown as RabbitMqService);
    (service as unknown as { logger: NestLoggerMock }).logger = new NestLoggerMock();
    // Action
    await service.publishPendingImageUrl('https://img4.idealista.com/a.jpg', '123');
    // Assert
    expect(rabbit.publishJsonToQueue).toHaveBeenCalledWith('pending-image-urls-to-download', {
      url: 'https://img4.idealista.com/a.jpg',
      propertyId: '123'
    });
  });

  it('whenQueuePublishFails_publishPendingImageUrl_shouldSwallowErrorWithoutThrowing', async () => {
    // Arrange
    const rabbit = new RabbitMqServiceMockForPendingQueue();
    rabbit.publishJsonToQueue.mockRejectedValue(new Error('broker error'));
    const service = new ImagePendingQueuePublisherService(rabbit as unknown as RabbitMqService);
    const logger = new NestLoggerMock();
    (service as unknown as { logger: NestLoggerMock }).logger = logger;
    // Action
    const action = service.publishPendingImageUrl('https://img4.idealista.com/a.jpg', '123');
    // Assert
    await expect(action).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
