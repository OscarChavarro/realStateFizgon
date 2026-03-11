import { Inject, Injectable, Logger } from '@nestjs/common';
import { Property } from 'src/domain/property/property.model';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { toErrorMessage } from 'src/infrastructure/error-message';
import { QueuePublisherPort } from 'src/ports/outbound/messaging/queue-publisher.port';
import { QUEUE_PUBLISHER_PORT } from 'src/ports/outbound/messaging/queue-publisher.port.token';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class PropertyDetailStorageService {
  private readonly logger = new Logger(PropertyDetailStorageService.name);
  private static readonly OUTGOING_NOTIFICATION_MESSAGES_QUEUE = 'outgoing-notification-messages';

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    @Inject(QUEUE_PUBLISHER_PORT)
    private readonly queuePublisherPort: QueuePublisherPort,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async markPropertyClosed(url: string, closedBy?: Date): Promise<void> {
    this.logger.warn(`Property URL is no longer available (deactivated-detail): ${url}`);
    await this.propertyPersistencePort.saveClosedProperty(url, closedBy);
  }

  async savePropertyWithImages(property: Property): Promise<void> {
    await this.imageDownloader.waitForImageNetworkSettled();
    const saveResult = await this.propertyPersistencePort.saveProperty(property);
    if (saveResult.isNew) {
      await this.publishNewPropertyNotification(property);
    }
    await this.imageDownloader.waitForPendingImageDownloads();
    await this.imageDownloader.movePropertyImagesFromIncoming(property);
  }

  private async publishNewPropertyNotification(property: Property): Promise<void> {
    try {
      await this.queuePublisherPort.publishJsonToQueue(
        PropertyDetailStorageService.OUTGOING_NOTIFICATION_MESSAGES_QUEUE,
        {
          url: property.url,
          title: property.title,
          type: 'IDEALISTA_UPDATE'
        }
      );
    } catch (error) {
      this.logger.error(
        `Property was stored in MongoDB but notification publish failed for "${property.url}". ${toErrorMessage(error)}`
      );
    }
  }
}
