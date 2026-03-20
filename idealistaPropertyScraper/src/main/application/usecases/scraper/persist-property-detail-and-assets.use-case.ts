import { Inject, Injectable } from '@nestjs/common';
import { ImageDownloaderService } from 'src/application/services/imagedownload/image-downloader';
import { PublishNewPropertyNotificationUseCase } from 'src/application/usecases/imagedownload/publish-new-property-notification.use-case';
import { Property } from 'src/domain/property/property.model';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class PersistPropertyDetailAndAssetsUseCase {
  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly publishNewPropertyNotificationUseCase: PublishNewPropertyNotificationUseCase,
    private readonly imageDownloader: ImageDownloaderService
  ) {}

  async execute(property: Property): Promise<void> {
    await this.imageDownloader.waitForImageNetworkSettled();
    const saveResult = await this.propertyPersistencePort.saveProperty(property);
    if (saveResult.isNew) {
      await this.publishNewPropertyNotificationUseCase.execute(property);
    }
    await this.imageDownloader.waitForPendingImageDownloads();
    await this.imageDownloader.movePropertyImagesFromIncoming(property);
  }
}
