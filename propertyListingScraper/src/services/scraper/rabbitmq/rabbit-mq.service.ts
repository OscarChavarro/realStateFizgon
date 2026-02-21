import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { Configuration } from '../../../config/configuration';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private readonly queueName = 'property-listing-urls';
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly configuration: Configuration) {}

  async publishPropertyUrls(urls: string[]): Promise<void> {
    if (urls.length === 0) {
      return;
    }

    const channel = await this.getChannel();
    for (const url of urls) {
      channel.sendToQueue(this.queueName, Buffer.from(url), { persistent: true });
    }

    this.logger.log(`Published ${urls.length} property URLs to RabbitMQ queue "${this.queueName}".`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  private async getChannel(): Promise<amqp.Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.connection) {
      this.connection = await amqp.connect({
        protocol: 'amqp',
        hostname: this.configuration.rabbitMqHost,
        port: this.configuration.rabbitMqPort,
        vhost: this.configuration.rabbitMqVhost,
        username: this.configuration.rabbitMqUser,
        password: this.configuration.rabbitMqPassword
      });
    }

    const channel = await this.connection.createChannel();
    await channel.assertQueue(this.queueName, { durable: true });
    this.channel = channel;
    return channel;
  }
}
