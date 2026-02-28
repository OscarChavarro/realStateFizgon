import { Injectable, Logger } from '@nestjs/common';
import { Property } from '../../../model/property/property.model';
import { ImageDownloader } from '../../imagedownload/image-downloader';
import { MongoDatabaseService } from '../../mongodb/mongo-database.service';

@Injectable()
export class PropertyDetailStorageService {
  private readonly logger = new Logger(PropertyDetailStorageService.name);

  constructor(
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async markPropertyClosed(url: string): Promise<void> {
    this.logger.warn(`Property URL is no longer available (deactivated-detail): ${url}`);
    await this.mongoDatabaseService.saveClosedProperty(url);
  }

  async savePropertyWithImages(property: Property): Promise<void> {
    await this.imageDownloader.waitForImageNetworkSettled();
    await this.mongoDatabaseService.saveProperty(property);
    await this.imageDownloader.waitForPendingImageDownloads();
    await this.imageDownloader.movePropertyImagesFromIncoming(property);
  }
}
