import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Configuration } from '../../config/configuration';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private static readonly OUTGOING_NOTIFICATION_MESSAGES_QUEUE = 'outgoing-notification-messages';
  private readonly fallbackFilePath = join(process.cwd(), 'output', 'audit', 'pending-property-urls.ndjson');
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly configuration: Configuration) {}

  async publishPropertyUrls(urls: string[]): Promise<void> {
    if (urls.length === 0) {
      return;
    }

    try {
      const channel = await this.getChannel();
      await channel.assertQueue(this.configuration.rabbitMqQueue, { durable: true });
      for (const url of urls) {
        channel.sendToQueue(this.configuration.rabbitMqQueue, Buffer.from(url), { persistent: true });
      }

      this.logger.log(`Published ${urls.length} property URLs to RabbitMQ queue "${this.configuration.rabbitMqQueue}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`RabbitMQ publish failed. URLs will be persisted locally for audit/retry. Error: ${message}`);
      this.resetConnection();
      this.persistUrlsLocally(urls, message);
    }
  }

  async publishIdealistaUpdateNotification(url: string, title: string | null): Promise<void> {
    await this.publishJsonToQueue(RabbitMqService.OUTGOING_NOTIFICATION_MESSAGES_QUEUE, {
      url,
      title,
      type: 'IDEALISTA_UPDATE'
    });
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
    this.channel = channel;
    return channel;
  }

  async publishJsonToQueue(queueName: string, payload: unknown): Promise<void> {
    const channel = await this.getChannel();
    await channel.assertQueue(queueName, { durable: true });
    const body = Buffer.from(JSON.stringify(payload), 'utf-8');
    channel.sendToQueue(queueName, body, {
      persistent: true,
      contentType: 'application/json'
    });
  }

  private persistUrlsLocally(urls: string[], reason: string): void {
    mkdirSync(join(process.cwd(), 'output', 'audit'), { recursive: true });
    const timestamp = new Date().toISOString();

    for (const url of urls) {
      appendFileSync(
        this.fallbackFilePath,
        `${JSON.stringify({ timestamp, url, reason })}\n`,
        'utf-8'
      );
    }

    this.logger.warn(
      `Stored ${urls.length} URLs in local audit file: ${this.fallbackFilePath}`
    );
  }

  private resetConnection(): void {
    this.channel = null;
    this.connection = null;
  }
}
