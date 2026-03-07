import { Module } from '@nestjs/common';
import { RabbitMqModule } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';
import { ImageFileNameService } from 'src/application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'src/application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'src/application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';
import { ConfigurationModule } from 'src/infrastructure/config/configuration.module';

@Module({
  imports: [ConfigurationModule, RabbitMqModule],
  providers: [
    ImageDownloadPathService,
    ImageUrlRulesService,
    ImageFileNameService,
    ImageNetworkCaptureService,
    ImagePendingQueuePublisherService,
    ImageDownloader
  ],
  exports: [ImageDownloader]
})
export class ImageDownloadModule {}
