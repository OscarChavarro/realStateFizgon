import { Module } from '@nestjs/common';
import { HttpBinaryDownloadService } from 'adapters/outbound/network/http-binary-download.service';
import { HTTP_BINARY_DOWNLOAD_PORT } from 'ports/outbound/network/http-binary-download.port.token';

@Module({
  providers: [
    HttpBinaryDownloadService,
    {
      provide: HTTP_BINARY_DOWNLOAD_PORT,
      useExisting: HttpBinaryDownloadService
    }
  ],
  exports: [HttpBinaryDownloadService, HTTP_BINARY_DOWNLOAD_PORT]
})
export class HttpBinaryDownloadModule {}
