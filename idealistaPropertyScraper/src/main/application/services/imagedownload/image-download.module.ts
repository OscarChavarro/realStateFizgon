import { Module } from '@nestjs/common';
import { FileSystemModule } from 'src/adapters/outbound/filesystem/file-system.module';
import { RabbitMqModule } from 'src/adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { ErrorMessageModule } from 'src/adapters/outbound/observability/error-message.module';
import { SleepModule } from 'src/adapters/outbound/timing/sleep.module';
import { ImageDownloadPathService } from 'src/application/services/imagedownload/image-download-path.service';
import { ImageDownloaderService } from 'src/application/services/imagedownload/image-downloader';
import { ImageFileNameService } from 'src/application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'src/application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'src/application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';
import { FinalizePropertyImagesUseCase } from 'src/application/usecases/imagedownload/finalize-property-images.use-case';
import { ConfigurationModule } from 'src/infrastructure/config/settings/configuration.module';

@Module({
  imports: [ConfigurationModule, RabbitMqModule, FileSystemModule, ErrorMessageModule, SleepModule],
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
