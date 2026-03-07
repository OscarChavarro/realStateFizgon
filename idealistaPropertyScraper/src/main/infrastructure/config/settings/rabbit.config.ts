import { Injectable } from '@nestjs/common';
import { ConfigurationSourceService } from 'src/infrastructure/config/settings/configuration-source.service';

@Injectable()
export class RabbitConfig {
  constructor(private readonly configurationSourceService: ConfigurationSourceService) {}

  get rabbitMqHost(): string {
    return this.configurationSourceService.secrets.rabbitmq?.host
      ?? this.configurationSourceService.environment.rabbitmq?.host
      ?? 'localhost';
  }

  get rabbitMqPort(): number {
    return this.configurationSourceService.secrets.rabbitmq?.port
      ?? this.configurationSourceService.environment.rabbitmq?.port
      ?? 5672;
  }

  get rabbitMqVhost(): string {
    return this.configurationSourceService.secrets.rabbitmq?.vhost ?? 'dev';
  }

  get rabbitMqQueue(): string {
    return this.configurationSourceService.secrets.rabbitmq?.queue ?? 'property-listing-urls';
  }

  get rabbitMqUser(): string {
    return this.configurationSourceService.secrets.rabbitmq?.user ?? '';
  }

  get rabbitMqPassword(): string {
    return this.configurationSourceService.secrets.rabbitmq?.password ?? '';
  }
}
