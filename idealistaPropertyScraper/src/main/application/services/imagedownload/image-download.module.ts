import { Module } from '@nestjs/common';
import { ImageDownloadPathService } from 'application/services/imagedownload/image-download-path.service';
import { ImageDownloaderService } from 'application/services/imagedownload/image-downloader';
import { ImageFileNameService } from 'application/services/imagedownload/image-file-name.service';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import { ImagePendingQueuePublisherService } from 'application/services/imagedownload/image-pending-queue-publisher.service';
import { ImageUrlRulesService } from 'application/services/imagedownload/image-url-rules.service';
import { FinalizePropertyImagesUseCase } from 'application/usecases/imagedownload/finalize-property-images.use-case';

@Module({
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
