import { describe, expect, it, jest } from '@jest/globals';
import { ImagePendingQueuePublisherService } from 'application/services/imagedownload/image-pending-queue-publisher.service';
import type { PendingImageUrlPublisherPort } from 'ports/outbound/messaging/pending-image-url-publisher.port';

class NestLoggerMock {
  readonly error = jest.fn<(message: string) => void>();
}

class PendingImageUrlPublisherPortMock implements PendingImageUrlPublisherPort {
  readonly publishPendingImageUrl = jest.fn<(message: { url: string; propertyId: string }) => Promise<void>>();
}

function createErrorMessagePort() {
  return {
    toErrorMessage: jest.fn((error: unknown) => (error instanceof Error ? error.message : String(error)))
  };
}

describe('ImagePendingQueuePublisherService', () => {
  it('whenQueuePublishSucceeds_publishPendingImageUrl_shouldSendSemanticIntent', async () => {
    // Arrange
    const pendingImageUrlPublisherPort = new PendingImageUrlPublisherPortMock();
    pendingImageUrlPublisherPort.publishPendingImageUrl.mockResolvedValue(undefined);
    const service = new ImagePendingQueuePublisherService(
      pendingImageUrlPublisherPort,
      createErrorMessagePort() as never
    );
    (service as unknown as { logger: NestLoggerMock }).logger = new NestLoggerMock();
    // Action
    await service.publishPendingImageUrl('https://img4.idealista.com/a.jpg', '123');
    // Assert
    expect(pendingImageUrlPublisherPort.publishPendingImageUrl).toHaveBeenCalledWith({
      url: 'https://img4.idealista.com/a.jpg',
      propertyId: '123'
    });
  });

  it('whenQueuePublishFails_publishPendingImageUrl_shouldSwallowErrorWithoutThrowing', async () => {
    // Arrange
    const pendingImageUrlPublisherPort = new PendingImageUrlPublisherPortMock();
    pendingImageUrlPublisherPort.publishPendingImageUrl.mockRejectedValue(new Error('broker error'));
    const service = new ImagePendingQueuePublisherService(
      pendingImageUrlPublisherPort,
      createErrorMessagePort() as never
    );
    const logger = new NestLoggerMock();
    (service as unknown as { logger: NestLoggerMock }).logger = logger;
    // Action
    const action = service.publishPendingImageUrl('https://img4.idealista.com/a.jpg', '123');
    // Assert
    await expect(action).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
