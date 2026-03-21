import { Inject, Injectable } from '@nestjs/common';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { PublishNewPropertyNotificationUseCase } from 'application/usecases/imagedownload/publish-new-property-notification.use-case';
import { Property } from 'domain/property/property';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { PROPERTY_WRITE_PORT } from 'ports/outbound/persistence/property-write.port.token';

@Injectable()
export class PersistPropertyDetailAndAssetsUseCase {
  constructor(
    @Inject(PROPERTY_WRITE_PORT)
    private readonly propertyWritePort: PropertyWritePort,
    private readonly publishNewPropertyNotificationUseCase: PublishNewPropertyNotificationUseCase,
    private readonly imageDownloader: ImageDownloaderService
  ) {}

  async execute(property: Property): Promise<void> {
    await this.imageDownloader.waitForImageNetworkSettled();
    const saveResult = await this.propertyWritePort.saveProperty(property);
    if (saveResult.isNew) {
      await this.publishNewPropertyNotificationUseCase.execute(property);
    }
    await this.imageDownloader.waitForPendingImageDownloads();
    await this.imageDownloader.movePropertyImagesFromIncoming(property);
  }
}
