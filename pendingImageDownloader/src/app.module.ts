import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from 'src/config/configuration';
import { ImageDownloadPathService } from 'src/services/imagedownload/image-download-path.service';
import { ImageFileNameService } from 'src/services/imagedownload/image-file-name.service';
import { PendingImageDownloadService } from 'src/services/imagedownload/pending-image-download.service';
import { RabbitMqService } from 'src/services/rabbitmq/rabbit-mq.service';

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

