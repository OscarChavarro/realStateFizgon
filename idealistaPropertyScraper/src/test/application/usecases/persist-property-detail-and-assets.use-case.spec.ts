import { describe, expect, it, jest } from '@jest/globals';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { PersistPropertyDetailAndAssetsUseCase } from 'src/application/usecases/persist-property-detail-and-assets.use-case';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';
import { QueuePublisherPort } from 'src/ports/outbound/messaging/queue-publisher.port';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';

class QueuePublisherPortMockForPersistPropertyDetailAndAssetsUseCase {
  readonly publishJsonToQueue = jest.fn<(queueName: string, payload: unknown) => Promise<void>>();
}

class PropertyPersistencePortMockForPersistPropertyDetailAndAssetsUseCase {
  readonly saveProperty = jest.fn<(property: Property) => Promise<{ isNew: boolean }>>();
}

class ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase {
  readonly waitForImageNetworkSettled = jest.fn<() => Promise<void>>();
  readonly waitForPendingImageDownloads = jest.fn<() => Promise<void>>();
  readonly movePropertyImagesFromIncoming = jest.fn<(property: Property) => Promise<void>>();
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

describe('PersistPropertyDetailAndAssetsUseCase', () => {
  it('whenPropertyIsNew_execute_shouldPersistImagesAndPublishNotification', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMockForPersistPropertyDetailAndAssetsUseCase();
    mongo.saveProperty.mockResolvedValue({ isNew: true });
    const queuePublisher = new QueuePublisherPortMockForPersistPropertyDetailAndAssetsUseCase();
    queuePublisher.publishJsonToQueue.mockResolvedValue(undefined);
    const imageDownloader = new ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase();
    imageDownloader.waitForImageNetworkSettled.mockResolvedValue(undefined);
    imageDownloader.waitForPendingImageDownloads.mockResolvedValue(undefined);
    imageDownloader.movePropertyImagesFromIncoming.mockResolvedValue(undefined);
    const useCase = new PersistPropertyDetailAndAssetsUseCase(
      mongo as unknown as PropertyPersistencePort,
      queuePublisher as unknown as QueuePublisherPort,
      imageDownloader as unknown as ImageDownloader
    );
    const property = createProperty();
    // Action
    await useCase.execute(property);
    // Assert
    expect(imageDownloader.waitForImageNetworkSettled).toHaveBeenCalledTimes(1);
    expect(mongo.saveProperty).toHaveBeenCalledWith(property);
    expect(queuePublisher.publishJsonToQueue).toHaveBeenCalledWith(
      'outgoing-notification-messages',
      expect.objectContaining({
        url: property.url,
        title: property.title,
        type: 'IDEALISTA_UPDATE'
      })
    );
    expect(imageDownloader.waitForPendingImageDownloads).toHaveBeenCalledTimes(1);
    expect(imageDownloader.movePropertyImagesFromIncoming).toHaveBeenCalledWith(property);
  });

  it('whenPropertyAlreadyExists_execute_shouldSkipNotificationPublish', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMockForPersistPropertyDetailAndAssetsUseCase();
    mongo.saveProperty.mockResolvedValue({ isNew: false });
    const queuePublisher = new QueuePublisherPortMockForPersistPropertyDetailAndAssetsUseCase();
    const imageDownloader = new ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase();
    imageDownloader.waitForImageNetworkSettled.mockResolvedValue(undefined);
    imageDownloader.waitForPendingImageDownloads.mockResolvedValue(undefined);
    imageDownloader.movePropertyImagesFromIncoming.mockResolvedValue(undefined);
    const useCase = new PersistPropertyDetailAndAssetsUseCase(
      mongo as unknown as PropertyPersistencePort,
      queuePublisher as unknown as QueuePublisherPort,
      imageDownloader as unknown as ImageDownloader
    );
    // Action
    await useCase.execute(createProperty());
    // Assert
    expect(queuePublisher.publishJsonToQueue).not.toHaveBeenCalled();
  });

  it('whenNotificationPublishFails_execute_shouldLogErrorAndContinuePipeline', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMockForPersistPropertyDetailAndAssetsUseCase();
    mongo.saveProperty.mockResolvedValue({ isNew: true });
    const queuePublisher = new QueuePublisherPortMockForPersistPropertyDetailAndAssetsUseCase();
    queuePublisher.publishJsonToQueue.mockRejectedValue(new Error('broker down'));
    const imageDownloader = new ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase();
    imageDownloader.waitForImageNetworkSettled.mockResolvedValue(undefined);
    imageDownloader.waitForPendingImageDownloads.mockResolvedValue(undefined);
    imageDownloader.movePropertyImagesFromIncoming.mockResolvedValue(undefined);
    const useCase = new PersistPropertyDetailAndAssetsUseCase(
      mongo as unknown as PropertyPersistencePort,
      queuePublisher as unknown as QueuePublisherPort,
      imageDownloader as unknown as ImageDownloader
    );
    const loggerErrorSpy = jest.spyOn(
      (useCase as unknown as { logger: { error: (message: string) => void } }).logger,
      'error'
    ).mockImplementation(() => undefined);
    // Action
    await useCase.execute(createProperty());
    // Assert
    expect(queuePublisher.publishJsonToQueue).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Property was stored in MongoDB but notification publish failed')
    );
    expect(imageDownloader.waitForPendingImageDownloads).toHaveBeenCalledTimes(1);
    expect(imageDownloader.movePropertyImagesFromIncoming).toHaveBeenCalledTimes(1);
  });
});
