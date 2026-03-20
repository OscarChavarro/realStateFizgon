import { Injectable } from '@nestjs/common';
import { ImageDownloader } from 'src/application/services/imagedownload/image-downloader';

@Injectable()
export class ValidateImageDownloadFolderPreCheckUseCase {
  constructor(private readonly imageDownloader: ImageDownloader) {}

  async execute(): Promise<void> {
    await this.imageDownloader.validateImageDownloadFolder();
  }
}
