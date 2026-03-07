import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfirmChannel, ChannelModel, connect, Options } from 'amqplib';
import { once } from 'node:events';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Configuration } from 'src/infrastructure/config/configuration';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private static readonly OUTGOING_NOTIFICATION_MESSAGES_QUEUE = 'outgoing-notification-messages';
  private readonly fallbackFilePath = join(process.cwd(), 'output', 'audit', 'pending-property-urls.ndjson');
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connectionPromise: Promise<ChannelModel> | null = null;
  private channelPromise: Promise<ConfirmChannel> | null = null;
  private shuttingDown = false;

  constructor(private readonly configuration: Configuration) {}

  async publishPropertyUrls(urls: string[]): Promise<void> {
    if (urls.length === 0) {
      return;
    }

    try {
      await this.publishWithRetry(async () => {
        const channel = await this.getChannel();
        await channel.assertQueue(this.configuration.rabbitMqQueue, { durable: true });
        for (const url of urls) {
          await this.sendWithBackpressure(
            channel,
            this.configuration.rabbitMqQueue,
            Buffer.from(url),
            { persistent: true }
          );
        }
        await channel.waitForConfirms();
      }, this.configuration.rabbitMqQueue);
      this.logger.log(`Published ${urls.length} property URLs to RabbitMQ queue "${this.configuration.rabbitMqQueue}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`RabbitMQ publish failed. URLs will be persisted locally for audit/retry. Error: ${message}`);
      await this.resetConnection();
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
    this.shuttingDown = true;
    await this.resetConnection();
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    if (this.channelPromise) {
      return this.channelPromise;
    }

    const channelPromise = (async () => {
      const connection = await this.getConnection();
      const channel = await connection.createConfirmChannel();
      this.attachChannelLifecycleHandlers(channel);
      this.channel = channel;
      return channel;
    })();

    this.channelPromise = channelPromise;

    try {
      return await channelPromise;
    } finally {
      if (this.channelPromise === channelPromise) {
        this.channelPromise = null;
      }
    }
  }

  async publishJsonToQueue(queueName: string, payload: unknown): Promise<void> {
    await this.publishWithRetry(async () => {
      const channel = await this.getChannel();
      await channel.assertQueue(queueName, { durable: true });
      const body = Buffer.from(JSON.stringify(payload), 'utf-8');
      await this.sendWithBackpressure(channel, queueName, body, {
        persistent: true,
        contentType: 'application/json'
      });
      await channel.waitForConfirms();
    }, queueName);
  }

  private async getConnection(): Promise<ChannelModel> {
    if (this.connection) {
      return this.connection;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const connectionPromise = (async () => {
      const connection = await connect({
        protocol: 'amqp',
        hostname: this.configuration.rabbitMqHost,
        port: this.configuration.rabbitMqPort,
        vhost: this.configuration.rabbitMqVhost,
        username: this.configuration.rabbitMqUser,
        password: this.configuration.rabbitMqPassword
      });
      this.attachConnectionLifecycleHandlers(connection);
      this.connection = connection;
      return connection;
    })();

    this.connectionPromise = connectionPromise;

    try {
      return await connectionPromise;
    } finally {
      if (this.connectionPromise === connectionPromise) {
        this.connectionPromise = null;
      }
    }
  }

  private attachConnectionLifecycleHandlers(connection: ChannelModel): void {
    connection.on('error', (error: unknown) => {
      if (this.connection !== connection) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`RabbitMQ connection error: ${message}`);
    });

    connection.on('close', () => {
      if (this.connection !== connection) {
        return;
      }
      if (!this.shuttingDown) {
        this.logger.warn('RabbitMQ connection closed. Next publish will reconnect automatically.');
      }
      this.connection = null;
      this.channel = null;
      this.connectionPromise = null;
      this.channelPromise = null;
    });

    connection.on('blocked', (reason: string) => {
      this.logger.warn(`RabbitMQ connection blocked by broker: ${reason}`);
    });

    connection.on('unblocked', () => {
      this.logger.log('RabbitMQ connection unblocked by broker.');
    });
  }

  private attachChannelLifecycleHandlers(channel: ConfirmChannel): void {
    channel.on('error', (error: unknown) => {
      if (this.channel !== channel) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`RabbitMQ channel error: ${message}`);
    });

    channel.on('close', () => {
      if (this.channel !== channel) {
        return;
      }
      if (!this.shuttingDown) {
        this.logger.warn('RabbitMQ channel closed. Next publish will recreate it.');
      }
      this.channel = null;
      this.channelPromise = null;
    });
  }

  private async sendWithBackpressure(
    channel: ConfirmChannel,
    queueName: string,
    body: Buffer,
    options: Options.Publish
  ): Promise<void> {
    const writable = channel.sendToQueue(queueName, body, options);
    if (!writable) {
      await once(channel, 'drain');
    }
  }

  private async publishWithRetry(
    publish: () => Promise<void>,
    queueName: string,
    maxRetries = 1
  ): Promise<void> {
    let attempt = 0;
    while (true) {
      try {
        await publish();
        return;
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `RabbitMQ publish attempt ${attempt} failed for queue "${queueName}". Reconnecting and retrying. Error: ${message}`
        );
        await this.resetConnection();
      }
    }
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

  private async resetConnection(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;

    this.channel = null;
    this.connection = null;
    this.channelPromise = null;
    this.connectionPromise = null;

    if (channel) {
      try {
        await channel.close();
      } catch {
      }
    }

    if (connection) {
      try {
        await connection.close();
      } catch {
      }
    }
  }
}
