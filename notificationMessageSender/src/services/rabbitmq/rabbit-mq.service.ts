import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage, connect } from 'amqplib';
import { Configuration } from 'src/config/configuration';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private consumeSetupPromise: Promise<void> | null = null;
  private shuttingDown = false;
  private consumer: ((message: unknown) => Promise<void>) | null = null;

  constructor(private readonly configuration: Configuration) {}

  async consumeMessages(consumer: (message: unknown) => Promise<void>): Promise<void> {
    this.consumer = consumer;
    await this.ensureConsumerIsActive();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.consumeSetupPromise = null;
    this.consumer = null;

    if (this.channel) {
      await this.closeChannelSafely(this.channel);
      this.channel = null;
    }

    if (this.connection) {
      await this.closeConnectionSafely(this.connection);
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

  private async ensureConsumerIsActive(): Promise<void> {
    if (this.consumeSetupPromise) {
      return this.consumeSetupPromise;
    }

    this.consumeSetupPromise = this.connectAndStartConsumer().finally(() => {
      this.consumeSetupPromise = null;
    });
    return this.consumeSetupPromise;
  }

  private async connectAndStartConsumer(): Promise<void> {
    if (!this.consumer) {
      return;
    }

    while (!this.shuttingDown) {
      try {
        const channel = await this.getChannel();
        await channel.prefetch(1);
        await channel.consume(this.configuration.rabbitMqQueue, async (message) => {
          if (!message || !this.consumer) {
            return;
          }

          const payload = this.parseMessage(message.content.toString('utf-8'));
          try {
            await this.consumer(payload);
            this.ackSafely(channel, message);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to process outgoing notification message: ${messageText}`);
            await this.sleep(1000);
            this.nackSafely(channel, message);
          }
        });

        this.logger.log(`Consuming messages from RabbitMQ queue "${this.configuration.rabbitMqQueue}".`);
        return;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        this.logger.error(`RabbitMQ consumer setup failed: ${messageText}`);
        await this.sleep(this.configuration.rabbitMqReconnectDelayMs);
      }
    }
  }

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.connection) {
      const connection = await connect({
        protocol: 'amqp',
        hostname: this.configuration.rabbitMqHost,
        port: this.configuration.rabbitMqPort,
        vhost: this.configuration.rabbitMqVhost,
        username: this.configuration.rabbitMqUser,
        password: this.configuration.rabbitMqPassword,
        heartbeat: this.configuration.rabbitMqHeartbeatSeconds
      });
      this.connection = connection;
      connection.on('error', (error) => {
        const messageText = error instanceof Error ? error.message : String(error);
        this.logger.error(`RabbitMQ connection error: ${messageText}`);
      });
      connection.on('close', () => {
        if (this.shuttingDown) {
          return;
        }
        this.logger.warn('RabbitMQ connection closed. Scheduling reconnect.');
        this.invalidateConnectionStateAndScheduleReconnect();
      });
    }

    const connection = this.connection;
    if (!connection) {
      throw new Error('RabbitMQ connection is not available.');
    }

    const channel = await connection.createChannel();
    channel.on('error', (error: unknown) => {
      const messageText = error instanceof Error ? error.message : String(error);
      this.logger.error(`RabbitMQ channel error: ${messageText}`);
    });
    channel.on('close', () => {
      if (this.shuttingDown) {
        return;
      }
      this.logger.warn('RabbitMQ channel closed. Scheduling reconnect.');
      this.invalidateConnectionStateAndScheduleReconnect();
    });

    await channel.assertQueue(this.configuration.rabbitMqQueue, { durable: true });
    this.channel = channel;
    return channel;
  }

  private invalidateConnectionStateAndScheduleReconnect(): void {
    if (this.shuttingDown) {
      return;
    }

    this.channel = null;
    this.connection = null;

    if (this.reconnectTimer || !this.consumer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shuttingDown || !this.consumer) {
        return;
      }

      void this.ensureConsumerIsActive().catch((error) => {
        const messageText = error instanceof Error ? error.message : String(error);
        this.logger.error(`RabbitMQ reconnect failed: ${messageText}`);
      });
    }, this.configuration.rabbitMqReconnectDelayMs);
  }

  private ackSafely(channel: Channel, message: ConsumeMessage): void {
    try {
      channel.ack(message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ACK RabbitMQ message: ${messageText}`);
      this.invalidateConnectionStateAndScheduleReconnect();
    }
  }

  private nackSafely(channel: Channel, message: ConsumeMessage): void {
    try {
      channel.nack(message, false, true);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to NACK RabbitMQ message: ${messageText}`);
      this.invalidateConnectionStateAndScheduleReconnect();
    }
  }

  private async closeChannelSafely(channel: Channel): Promise<void> {
    try {
      await channel.close();
    } catch {
      // Ignore close errors during shutdown.
    }
  }

  private async closeConnectionSafely(connection: ChannelModel): Promise<void> {
    try {
      await connection.close();
    } catch {
      // Ignore close errors during shutdown.
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
