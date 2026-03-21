import { describe, expect, it, jest } from '@jest/globals';
import { createScrapeRunContext, ScrapeRunContext } from 'application/context/scrape-run-context';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { PersistPropertyDetailAndAssetsUseCase } from 'application/usecases/scraper/persist-property-detail-and-assets.use-case';
import { PublishNewPropertyNotificationUseCase } from 'application/usecases/imagedownload/publish-new-property-notification.use-case';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { Property } from 'domain/property/property';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';

class PublishNewPropertyNotificationUseCaseMockForPersistPropertyDetailAndAssetsUseCase {
  readonly execute = jest.fn<(property: Property) => Promise<void>>();
}

class PropertyPersistencePortMockForPersistPropertyDetailAndAssetsUseCase {
  readonly saveProperty = jest.fn<(property: Property) => Promise<{ isNew: boolean }>>();
}

class ImageDownloaderMockForPersistPropertyDetailAndAssetsUseCase {
  readonly waitForImageNetworkSettled = jest.fn<(scrapeRunContext: ScrapeRunContext) => Promise<void>>();
  readonly waitForPendingImageDownloads = jest.fn<(scrapeRunContext: ScrapeRunContext) => Promise<void>>();
  readonly movePropertyImagesFromIncoming = jest.fn<
    (property: Property, scrapeRunContext: ScrapeRunContext) => Promise<void>
  >();
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
      mongo as unknown as PropertyWritePort,
      publishNewPropertyNotificationUseCase as unknown as PublishNewPropertyNotificationUseCase,
      imageDownloader as unknown as ImageDownloaderService
    );
    const property = createProperty();
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(property, scrapeRunContext);
    // Assert
    expect(imageDownloader.waitForImageNetworkSettled).toHaveBeenCalledWith(scrapeRunContext);
    expect(mongo.saveProperty).toHaveBeenCalledWith(property);
    expect(publishNewPropertyNotificationUseCase.execute).toHaveBeenCalledWith(property);
    expect(imageDownloader.waitForPendingImageDownloads).toHaveBeenCalledWith(scrapeRunContext);
    expect(imageDownloader.movePropertyImagesFromIncoming).toHaveBeenCalledWith(property, scrapeRunContext);
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
      mongo as unknown as PropertyWritePort,
      publishNewPropertyNotificationUseCase as unknown as PublishNewPropertyNotificationUseCase,
      imageDownloader as unknown as ImageDownloaderService
    );
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(createProperty(), scrapeRunContext);
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
      mongo as unknown as PropertyWritePort,
      publishNewPropertyNotificationUseCase as unknown as PublishNewPropertyNotificationUseCase,
      imageDownloader as unknown as ImageDownloaderService
    );
    const scrapeRunContext = createScrapeRunContext();
    // Action
    await useCase.execute(createProperty(), scrapeRunContext);
    // Assert
    expect(publishNewPropertyNotificationUseCase.execute).toHaveBeenCalledTimes(1);
    expect(imageDownloader.waitForPendingImageDownloads).toHaveBeenCalledWith(scrapeRunContext);
    expect(imageDownloader.movePropertyImagesFromIncoming).toHaveBeenCalledWith(expect.any(Property), scrapeRunContext);
  });
});
