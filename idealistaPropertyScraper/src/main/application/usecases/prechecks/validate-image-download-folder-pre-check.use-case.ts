import { Injectable } from '@nestjs/common';
import { ImageDownloaderService } from 'src/application/services/imagedownload/image-downloader';

@Injectable()
export class ValidateImageDownloadFolderPreCheckUseCase {
  constructor(private readonly imageDownloader: ImageDownloaderService) {}

  async execute(): Promise<void> {
    await this.imageDownloader.validateImageDownloadFolder();
  }
}
