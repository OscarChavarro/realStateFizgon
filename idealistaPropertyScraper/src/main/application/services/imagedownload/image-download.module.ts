import { Module } from '@nestjs/common';
import { FileSystemModule } from 'adapters/outbound/filesystem/file-system.module';
import { RabbitMqModule } from 'adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { ErrorMessageModule } from 'adapters/outbound/observability/error-message.module';
import { SleepModule } from 'adapters/outbound/timing/sleep.module';
import { ImageDownloadPathService } from 'application/services/imagedownload/image-download-path.service';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { ImageFileNameService } from 'application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';
import { FinalizePropertyImagesUseCase } from 'application/usecases/imagedownload/finalize-property-images.use-case';

@Module({
  imports: [RabbitMqModule, FileSystemModule, ErrorMessageModule, SleepModule],
  providers: [
    ImageDownloadPathService,
    ImageUrlRulesService,
    ImageFileNameService,
    ImageNetworkCaptureService,
    ImagePendingQueuePublisherService,
    FinalizePropertyImagesUseCase,
    ImageDownloaderService
  ],
  exports: [ImageDownloaderService]
})
export class ImageDownloadModule {}
