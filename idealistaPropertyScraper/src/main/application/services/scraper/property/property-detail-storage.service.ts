import { Inject, Injectable, Logger } from '@nestjs/common';
import { Property } from 'src/domain/property/property.model';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class PropertyDetailStorageService {
  private readonly logger = new Logger(PropertyDetailStorageService.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async markPropertyClosed(url: string, closedBy?: Date): Promise<void> {
    this.logger.warn(`Property URL is no longer available (deactivated-detail): ${url}`);
    await this.propertyPersistencePort.saveClosedProperty(url, closedBy);
  }

  async savePropertyWithImages(property: Property): Promise<void> {
    await this.imageDownloader.waitForImageNetworkSettled();
    await this.propertyPersistencePort.saveProperty(property);
    await this.imageDownloader.waitForPendingImageDownloads();
    await this.imageDownloader.movePropertyImagesFromIncoming(property);
  }
}
