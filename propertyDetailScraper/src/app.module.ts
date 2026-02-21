import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { ChromeService } from './services/scraper/chrome.service';
import { RabbitMqService } from './services/scraper/rabbitmq/rabbit-mq.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  providers: [Configuration, RabbitMqService, ChromeService]
})
export class AppModule {}
