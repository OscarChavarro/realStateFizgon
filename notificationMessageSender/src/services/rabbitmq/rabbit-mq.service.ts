import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { Configuration } from '../../config/configuration';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly configuration: Configuration) {}

  async consumeMessages(consumer: (message: unknown) => Promise<void>): Promise<void> {
    const channel = await this.getChannel();
    await channel.prefetch(1);

    await channel.consume(this.configuration.rabbitMqQueue, async (message) => {
      if (!message) {
        return;
      }

      const payload = this.parseMessage(message.content.toString('utf-8'));
      try {
        await consumer(payload);
        channel.ack(message);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to process outgoing notification message: ${messageText}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        channel.nack(message, false, true);
      }
    });

    this.logger.log(`Consuming messages from RabbitMQ queue "${this.configuration.rabbitMqQueue}".`);
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

  private parseMessage(raw: string): unknown {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
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
    await channel.assertQueue(this.configuration.rabbitMqQueue, { durable: true });
    this.channel = channel;
    return channel;
  }
}
