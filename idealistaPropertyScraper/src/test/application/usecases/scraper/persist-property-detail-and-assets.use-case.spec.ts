import { describe, expect, it, jest } from '@jest/globals';
import { ImageDownloaderService } from 'src/application/services/imagedownload/image-downloader';
import { PersistPropertyDetailAndAssetsUseCase } from 'src/application/usecases/scraper/persist-property-detail-and-assets.use-case';
import { PublishNewPropertyNotificationUseCase } from 'src/application/usecases/imagedownload/publish-new-property-notification.use-case';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';

class PublishNewPropertyNotificationUseCaseMockForPersistPropertyDetailAndAssetsUseCase {
  readonly execute = jest.fn<(property: Property) => Promise<void>>();
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
    const publishNewPropertyNotificationUseCase = new PublishNewPropertyNotificationUseCaseMockForPersistPropertyDetailAndAssetsUseCase();
    publishNewPropertyNotificationUseCase.execute.mockResolvedValue(undefined);
    const imageDownloader = new ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase();
    imageDownloader.waitForImageNetworkSettled.mockResolvedValue(undefined);
    imageDownloader.waitForPendingImageDownloads.mockResolvedValue(undefined);
    imageDownloader.movePropertyImagesFromIncoming.mockResolvedValue(undefined);
    const useCase = new PersistPropertyDetailAndAssetsUseCase(
      mongo as unknown as PropertyPersistencePort,
      publishNewPropertyNotificationUseCase as unknown as PublishNewPropertyNotificationUseCase,
      imageDownloader as unknown as ImageDownloaderService
    );
    const property = createProperty();
    // Action
    await useCase.execute(property);
    // Assert
    expect(imageDownloader.waitForImageNetworkSettled).toHaveBeenCalledTimes(1);
    expect(mongo.saveProperty).toHaveBeenCalledWith(property);
    expect(publishNewPropertyNotificationUseCase.execute).toHaveBeenCalledWith(property);
    expect(imageDownloader.waitForPendingImageDownloads).toHaveBeenCalledTimes(1);
    expect(imageDownloader.movePropertyImagesFromIncoming).toHaveBeenCalledWith(property);
  });

  it('whenPropertyAlreadyExists_execute_shouldSkipNotificationPublish', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMockForPersistPropertyDetailAndAssetsUseCase();
    mongo.saveProperty.mockResolvedValue({ isNew: false });
    const publishNewPropertyNotificationUseCase = new PublishNewPropertyNotificationUseCaseMockForPersistPropertyDetailAndAssetsUseCase();
    const imageDownloader = new ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase();
    imageDownloader.waitForImageNetworkSettled.mockResolvedValue(undefined);
    imageDownloader.waitForPendingImageDownloads.mockResolvedValue(undefined);
    imageDownloader.movePropertyImagesFromIncoming.mockResolvedValue(undefined);
    const useCase = new PersistPropertyDetailAndAssetsUseCase(
      mongo as unknown as PropertyPersistencePort,
      publishNewPropertyNotificationUseCase as unknown as PublishNewPropertyNotificationUseCase,
      imageDownloader as unknown as ImageDownloaderService
    );
    // Action
    await useCase.execute(createProperty());
    // Assert
    expect(publishNewPropertyNotificationUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenNotificationUseCaseCompletes_execute_shouldContinueImagePipeline', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMockForPersistPropertyDetailAndAssetsUseCase();
    mongo.saveProperty.mockResolvedValue({ isNew: true });
    const publishNewPropertyNotificationUseCase = new PublishNewPropertyNotificationUseCaseMockForPersistPropertyDetailAndAssetsUseCase();
    publishNewPropertyNotificationUseCase.execute.mockResolvedValue(undefined);
    const imageDownloader = new ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase();
    imageDownloader.waitForImageNetworkSettled.mockResolvedValue(undefined);
    imageDownloader.waitForPendingImageDownloads.mockResolvedValue(undefined);
    imageDownloader.movePropertyImagesFromIncoming.mockResolvedValue(undefined);
    const useCase = new PersistPropertyDetailAndAssetsUseCase(
      mongo as unknown as PropertyPersistencePort,
      publishNewPropertyNotificationUseCase as unknown as PublishNewPropertyNotificationUseCase,
      imageDownloader as unknown as ImageDownloaderService
    );
    // Action
    await useCase.execute(createProperty());
    // Assert
    expect(publishNewPropertyNotificationUseCase.execute).toHaveBeenCalledTimes(1);
    expect(imageDownloader.waitForPendingImageDownloads).toHaveBeenCalledTimes(1);
    expect(imageDownloader.movePropertyImagesFromIncoming).toHaveBeenCalledTimes(1);
  });
});
