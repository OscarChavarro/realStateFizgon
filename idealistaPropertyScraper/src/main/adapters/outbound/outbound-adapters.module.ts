import { Global, Module } from '@nestjs/common';
import { IdealistaCaptchaDetectorModule } from 'adapters/outbound/captcha/idealista-captcha-detector.module';
import { FileSystemModule } from 'adapters/outbound/filesystem/file-system.module';
import { RabbitMqModule } from 'adapters/outbound/messaging/rabbitmq/rabbit-mq.module';
import { HttpBinaryDownloadModule } from 'adapters/outbound/network/http-binary-download.module';
import { ProxyAccessValidatorModule } from 'adapters/outbound/network/proxy-access-validator.module';
import { ErrorMessageModule } from 'adapters/outbound/observability/error-message.module';
import { MongoDatabaseModule } from 'adapters/outbound/persistence/mongodb/mongo-database.module';
import { SleepModule } from 'adapters/outbound/timing/sleep.module';

@Global()
@Module({
  imports: [
    SleepModule,
    ErrorMessageModule,
    FileSystemModule,
    HttpBinaryDownloadModule,
    RabbitMqModule,
    ProxyAccessValidatorModule,
    IdealistaCaptchaDetectorModule,
    MongoDatabaseModule
  ],
  exports: [
    SleepModule,
    ErrorMessageModule,
    FileSystemModule,
    HttpBinaryDownloadModule,
    RabbitMqModule,
    ProxyAccessValidatorModule,
    IdealistaCaptchaDetectorModule,
    MongoDatabaseModule
  ]
})
export class OutboundAdaptersModule {}
