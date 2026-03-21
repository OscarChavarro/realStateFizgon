import { describe, expect, it, jest } from '@jest/globals';
import { PublishNewPropertyNotificationUseCase } from 'application/usecases/imagedownload/publish-new-property-notification.use-case';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { Property } from 'domain/property/property';
import type { NewPropertyNotificationPublisherPort } from 'ports/outbound/messaging/new-property-notification-publisher.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';

class NewPropertyNotificationPublisherPortMockForPublishNewPropertyNotificationUseCase implements NewPropertyNotificationPublisherPort {
  readonly publishNewPropertyNotification = jest.fn<(message: { url: string; title: string | null }) => Promise<void>>();
}

class ErrorMessagePortMockForPublishNewPropertyNotificationUseCase implements ErrorMessagePort {
  readonly toErrorMessage = jest.fn<(error: unknown) => string>();
}

function createProperty(): Property {
  return Property.create({
    propertyId: '123',
    url: 'https://www.idealista.com/inmueble/123/',
    title: 'Title',
    location: 'Madrid',
    price: 1000,
    mainFeatures: new PropertyMainFeatures('80 m2', '2', 'Exterior', []),
    advertiserComment: 'Comment',
    featureGroups: [new PropertyFeatureGroup('General', ['Ascensor'])],
    publicationAge: 'hace 3 días',
    images: [new PropertyImage('https://img/a.jpg', 'img')]
  });
}

describe('PublishNewPropertyNotificationUseCase', () => {
  it('whenPropertyIsNew_execute_shouldPublishSemanticIntent', async () => {
    // Arrange
    const newPropertyNotificationPublisherPort = new NewPropertyNotificationPublisherPortMockForPublishNewPropertyNotificationUseCase();
    newPropertyNotificationPublisherPort.publishNewPropertyNotification.mockResolvedValue(undefined);
    const errorMessagePort = new ErrorMessagePortMockForPublishNewPropertyNotificationUseCase();
    errorMessagePort.toErrorMessage.mockImplementation((error: unknown) => String(error));
    const useCase = new PublishNewPropertyNotificationUseCase(
      newPropertyNotificationPublisherPort,
      errorMessagePort
    );
    const property = createProperty();
    // Action
    await useCase.execute(property);
    // Assert
    expect(newPropertyNotificationPublisherPort.publishNewPropertyNotification).toHaveBeenCalledWith({
      url: property.url,
      title: property.title
    });
  });

  it('whenNotificationPublishFails_execute_shouldLogErrorAndResolve', async () => {
    // Arrange
    const newPropertyNotificationPublisherPort = new NewPropertyNotificationPublisherPortMockForPublishNewPropertyNotificationUseCase();
    newPropertyNotificationPublisherPort.publishNewPropertyNotification.mockRejectedValue(new Error('broker down'));
    const errorMessagePort = new ErrorMessagePortMockForPublishNewPropertyNotificationUseCase();
    errorMessagePort.toErrorMessage.mockImplementation((error: unknown) => String(error));
    const useCase = new PublishNewPropertyNotificationUseCase(
      newPropertyNotificationPublisherPort,
      errorMessagePort
    );
    const loggerErrorSpy = jest.spyOn(
      (useCase as unknown as { logger: { error: (message: string) => void } }).logger,
      'error'
    ).mockImplementation(() => undefined);
    // Action
    await expect(useCase.execute(createProperty())).resolves.toBeUndefined();
    // Assert
    expect(newPropertyNotificationPublisherPort.publishNewPropertyNotification).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Property was stored in MongoDB but notification publish failed')
    );
  });
});
