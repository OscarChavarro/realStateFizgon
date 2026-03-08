import { describe, expect, it, jest } from '@jest/globals';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../../ports/outbound/persistence/property-persistence-port.mock';

class ImageDownloaderMockForDetailStorage {
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

describe('PropertyDetailStorageService', () => {
  it('whenDetailIsDeactivated_markPropertyClosed_shouldPersistClosedStatus', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    mongo.saveClosedProperty.mockResolvedValue(undefined);
    const imageDownloader = new ImageDownloaderMockForDetailStorage();
    const service = new PropertyDetailStorageService(
      mongo as unknown as PropertyPersistencePort,
      imageDownloader as unknown as ImageDownloader
    );
    const closedBy = new Date('2026-01-15T00:00:00.000Z');
    // Action
    await service.markPropertyClosed('https://www.idealista.com/inmueble/123/', closedBy);
    // Assert
    expect(mongo.saveClosedProperty).toHaveBeenCalledWith('https://www.idealista.com/inmueble/123/', closedBy);
    expect(imageDownloader.waitForImageNetworkSettled).not.toHaveBeenCalled();
  });

  it('whenPropertyHasImages_savePropertyWithImages_shouldExecutePersistencePipelineInOrder', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    mongo.saveProperty.mockResolvedValue(undefined);
    const imageDownloader = new ImageDownloaderMockForDetailStorage();
    imageDownloader.waitForImageNetworkSettled.mockResolvedValue(undefined);
    imageDownloader.waitForPendingImageDownloads.mockResolvedValue(undefined);
    imageDownloader.movePropertyImagesFromIncoming.mockResolvedValue(undefined);
    const service = new PropertyDetailStorageService(
      mongo as unknown as PropertyPersistencePort,
      imageDownloader as unknown as ImageDownloader
    );
    const property = createProperty();
    // Action
    await service.savePropertyWithImages(property);
    // Assert
    expect(imageDownloader.waitForImageNetworkSettled).toHaveBeenCalledTimes(1);
    expect(mongo.saveProperty).toHaveBeenCalledWith(property);
    expect(imageDownloader.waitForPendingImageDownloads).toHaveBeenCalledTimes(1);
    expect(imageDownloader.movePropertyImagesFromIncoming).toHaveBeenCalledWith(property);
  });
});
