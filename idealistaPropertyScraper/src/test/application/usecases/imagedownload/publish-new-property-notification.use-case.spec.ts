import { describe, expect, it, jest } from '@jest/globals';
import { PublishNewPropertyNotificationUseCase } from 'application/usecases/imagedownload/publish-new-property-notification.use-case';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { Property } from 'domain/property/property';
import { QueuePublisherPort } from 'ports/outbound/messaging/queue-publisher.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

class QueuePublisherPortMockForPublishNewPropertyNotificationUseCase {
  readonly publishJsonToQueue = jest.fn<(queueName: string, payload: unknown) => Promise<void>>();
}

class ErrorMessagePortMockForPublishNewPropertyNotificationUseCase implements ErrorMessagePort {
  readonly toErrorMessage = jest.fn<(error: unknown) => string>();
}

function createProperty(): Property {
  return new Property(
    '123',
    'https://www.idealista.com/inmueble/123/',
    'Title',
    'Madrid',
    1000,
    new PropertyMainFeatures('80 m2', '2', 'Exterior', []),
    'Comment',
    [new PropertyFeatureGroup('General', ['Ascensor'])],
    'hace 3 días',
    [new PropertyImage('https://img/a.jpg', 'img')]
  );
}

describe('PublishNewPropertyNotificationUseCase', () => {
  it('whenPropertyIsNew_execute_shouldPublishIdealistaUpdateNotificationPayload', async () => {
    // Arrange
    const queuePublisherPort = new QueuePublisherPortMockForPublishNewPropertyNotificationUseCase();
    queuePublisherPort.publishJsonToQueue.mockResolvedValue(undefined);
    const errorMessagePort = new ErrorMessagePortMockForPublishNewPropertyNotificationUseCase();
    errorMessagePort.toErrorMessage.mockImplementation((error: unknown) => String(error));
    const useCase = new PublishNewPropertyNotificationUseCase(
      queuePublisherPort as unknown as QueuePublisherPort,
      errorMessagePort
    );
    const property = createProperty();
    // Action
    await useCase.execute(property);
    // Assert
    expect(queuePublisherPort.publishJsonToQueue).toHaveBeenCalledWith(
      'outgoing-notification-messages',
      {
        url: property.url,
        title: property.title,
        type: 'IDEALISTA_UPDATE'
      }
    );
  });

  it('whenNotificationPublishFails_execute_shouldLogErrorAndResolve', async () => {
    // Arrange
    const queuePublisherPort = new QueuePublisherPortMockForPublishNewPropertyNotificationUseCase();
    queuePublisherPort.publishJsonToQueue.mockRejectedValue(new Error('broker down'));
    const errorMessagePort = new ErrorMessagePortMockForPublishNewPropertyNotificationUseCase();
    errorMessagePort.toErrorMessage.mockImplementation((error: unknown) => String(error));
    const useCase = new PublishNewPropertyNotificationUseCase(
      queuePublisherPort as unknown as QueuePublisherPort,
      errorMessagePort
    );
    const loggerErrorSpy = jest.spyOn(
      (useCase as unknown as { logger: { error: (message: string) => void } }).logger,
      'error'
    ).mockImplementation(() => undefined);
    // Action
    await expect(useCase.execute(createProperty())).resolves.toBeUndefined();
    // Assert
    expect(queuePublisherPort.publishJsonToQueue).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Property was stored in MongoDB but notification publish failed')
    );
  });
});
