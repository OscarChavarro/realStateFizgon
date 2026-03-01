import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { ImageDownloadPathService } from './services/imagedownload/image-download-path.service';
import { ImageFileNameService } from './services/imagedownload/image-file-name.service';
import { PendingImageDownloadService } from './services/imagedownload/pending-image-download.service';
import { RabbitMqService } from './services/rabbitmq/rabbit-mq.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [
    Configuration,
    RabbitMqService,
    ImageDownloadPathService,
    ImageFileNameService,
    PendingImageDownloadService
  ]
})
export class AppModule {}

