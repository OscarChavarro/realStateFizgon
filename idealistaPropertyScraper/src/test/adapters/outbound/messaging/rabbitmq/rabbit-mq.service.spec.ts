import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { appendFileSync, mkdirSync } from 'node:fs';
import { connect } from 'amqplib';
import { RabbitMqService } from 'adapters/outbound/messaging/rabbitmq/rabbit-mq.service';
import { RabbitConfigMock } from '../../../../support/mocks/rabbit-config.mock';

jest.mock('amqplib', () => ({
  connect: jest.fn()
}));

jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

type FakeConfirmChannel = EventEmitter & {
  assertQueue: jest.MockedFunction<(queue: string, options: { durable: boolean }) => Promise<void>>;
  sendToQueue: jest.MockedFunction<(queue: string, body: Buffer, options: Record<string, unknown>) => boolean>;
  waitForConfirms: jest.MockedFunction<() => Promise<void>>;
  close: jest.MockedFunction<() => Promise<void>>;
};

type FakeConnection = EventEmitter & {
  createConfirmChannel: jest.MockedFunction<() => Promise<FakeConfirmChannel>>;
  close: jest.MockedFunction<() => Promise<void>>;
};

class NestLoggerMock {
  readonly log = jest.fn<(message: string) => void>();
  readonly warn = jest.fn<(message: string) => void>();
  readonly error = jest.fn<(message: string) => void>();
}

function createFakeChannel(): FakeConfirmChannel {
  const emitter = new EventEmitter() as FakeConfirmChannel;
  emitter.assertQueue = jest.fn(async () => undefined);
  emitter.sendToQueue = jest.fn(() => true);
  emitter.waitForConfirms = jest.fn(async () => undefined);
  emitter.close = jest.fn(async () => undefined);
  return emitter;
}

function createFakeConnection(channel: FakeConfirmChannel): FakeConnection {
  const emitter = new EventEmitter() as FakeConnection;
  emitter.createConfirmChannel = jest.fn(async () => channel);
  emitter.close = jest.fn(async () => undefined);
  return emitter;
}

function muteServiceLogger(service: RabbitMqService): NestLoggerMock {
  const logger = new NestLoggerMock();
  (service as unknown as { logger: NestLoggerMock }).logger = logger;
  return logger;
}

describe('RabbitMqService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenUrlListIsEmpty_publishPropertyUrls_shouldReturnWithoutPublishing', async () => {
    // Arrange
    const config = new RabbitConfigMock();
    const service = new RabbitMqService(config);
    muteServiceLogger(service);
    const publishWithRetrySpy = jest.spyOn(service as unknown as { publishWithRetry: () => Promise<void> }, 'publishWithRetry');
    // Action
    await service.publishPropertyUrls([]);
    // Assert
    expect(publishWithRetrySpy).not.toHaveBeenCalled();
  });

  it('whenBackpressureIsTriggered_publishJsonToQueue_shouldWaitForDrainBeforeConfirms', async () => {
    // Arrange
    const config = new RabbitConfigMock();
    const service = new RabbitMqService(config);
    muteServiceLogger(service);
    const channel = createFakeChannel();
    channel.sendToQueue.mockImplementation(() => {
      setTimeout(() => channel.emit('drain'), 0);
      return false;
    });
    const connection = createFakeConnection(channel);
    const connectMock = connect as unknown as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(connection as never);
    // Action
    await service.publishJsonToQueue('events', { id: 1 });
    // Assert
    expect(connectMock).toHaveBeenCalledWith({
      protocol: 'amqp',
      hostname: 'localhost',
      port: 5672,
      vhost: 'dev',
      username: 'guest',
      password: 'guest'
    });
    expect(channel.assertQueue).toHaveBeenCalledWith('events', { durable: true });
    expect(channel.waitForConfirms).toHaveBeenCalledTimes(1);
  });

  it('whenFirstPublishAttemptFails_publishWithRetry_shouldResetConnectionAndRetry', async () => {
    // Arrange
    const config = new RabbitConfigMock();
    const service = new RabbitMqService(config);
    const logger = muteServiceLogger(service);
    const resetConnectionSpy = jest.spyOn(service as unknown as { resetConnection: () => Promise<void> }, 'resetConnection');
    let attempts = 0;
    const publish = jest.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('temporary failure');
      }
    });
    // Action
    await (service as unknown as { publishWithRetry: (run: () => Promise<void>, queue: string) => Promise<void> })
      .publishWithRetry(publish, 'queue-a');
    // Assert
    expect(publish).toHaveBeenCalledTimes(2);
    expect(resetConnectionSpy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('whenPublishPropertyUrlsFails_publishPropertyUrls_shouldPersistLocallyAndResetConnection', async () => {
    // Arrange
    const config = new RabbitConfigMock();
    const service = new RabbitMqService(config);
    const logger = muteServiceLogger(service);
    const publishWithRetrySpy = jest.spyOn(service as unknown as { publishWithRetry: () => Promise<void> }, 'publishWithRetry')
      .mockRejectedValue(new Error('broker down'));
    const resetConnectionSpy = jest.spyOn(service as unknown as { resetConnection: () => Promise<void> }, 'resetConnection')
      .mockResolvedValue(undefined);
    const persistSpy = jest.spyOn(service as unknown as { persistUrlsLocally: (urls: string[], reason: string) => void }, 'persistUrlsLocally')
      .mockImplementation(() => undefined);
    // Action
    await service.publishPropertyUrls(['https://example.com/1']);
    // Assert
    expect(publishWithRetrySpy).toHaveBeenCalledTimes(1);
    expect(resetConnectionSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith(['https://example.com/1'], 'broker down');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('whenNotificationIsRequested_publishIdealistaUpdateNotification_shouldPublishExpectedPayload', async () => {
    // Arrange
    const config = new RabbitConfigMock();
    const service = new RabbitMqService(config);
    muteServiceLogger(service);
    const publishJsonSpy = jest.spyOn(service, 'publishJsonToQueue').mockResolvedValue(undefined);
    // Action
    await service.publishIdealistaUpdateNotification('https://idealista.com/inmueble/1/', 'Title');
    // Assert
    expect(publishJsonSpy).toHaveBeenCalledWith('outgoing-notification-messages', {
      url: 'https://idealista.com/inmueble/1/',
      title: 'Title',
      type: 'IDEALISTA_UPDATE'
    });
  });

  it('whenModuleIsDestroyed_onModuleDestroy_shouldMarkShutdownAndResetConnection', async () => {
    // Arrange
    const config = new RabbitConfigMock();
    const service = new RabbitMqService(config);
    muteServiceLogger(service);
    const resetConnectionSpy = jest.spyOn(service as unknown as { resetConnection: () => Promise<void> }, 'resetConnection')
      .mockResolvedValue(undefined);
    // Action
    await service.onModuleDestroy();
    // Assert
    expect(resetConnectionSpy).toHaveBeenCalledTimes(1);
  });

  it('whenConnectionEmitsClose_attachConnectionLifecycleHandlers_shouldResetConnectionAndChannelCaches', () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const channel = createFakeChannel();
    const connection = createFakeConnection(channel);
    (service as unknown as { connection: FakeConnection | null }).connection = connection;
    (service as unknown as { channel: FakeConfirmChannel | null }).channel = channel;
    (service as unknown as { attachConnectionLifecycleHandlers: (conn: FakeConnection) => void }).attachConnectionLifecycleHandlers(connection);
    // Action
    connection.emit('close');
    // Assert
    expect((service as unknown as { connection: FakeConnection | null }).connection).toBeNull();
    expect((service as unknown as { channel: FakeConfirmChannel | null }).channel).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('RabbitMQ connection closed. Next publish will reconnect automatically.');
  });

  it('whenChannelEmitsClose_attachChannelLifecycleHandlers_shouldResetChannelCache', () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const channel = createFakeChannel();
    (service as unknown as { channel: FakeConfirmChannel | null }).channel = channel;
    (service as unknown as { attachChannelLifecycleHandlers: (ch: FakeConfirmChannel) => void }).attachChannelLifecycleHandlers(channel);
    // Action
    channel.emit('close');
    // Assert
    expect((service as unknown as { channel: FakeConfirmChannel | null }).channel).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('RabbitMQ channel closed. Next publish will recreate it.');
  });

  it('whenRetriesAreExhausted_publishWithRetry_shouldThrowOriginalError', async () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    muteServiceLogger(service);
    const publish = jest.fn(async () => {
      throw new Error('hard failure');
    });
    // Action
    const action = (service as unknown as {
      publishWithRetry: (run: () => Promise<void>, queue: string, maxRetries?: number) => Promise<void>;
    }).publishWithRetry(publish, 'queue-z', 0);
    // Assert
    await expect(action).rejects.toThrow('hard failure');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('whenPersistingFallbackUrls_persistUrlsLocally_shouldWriteAuditLinesForEveryUrl', () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    // Action
    (service as unknown as { persistUrlsLocally: (urls: string[], reason: string) => void })
      .persistUrlsLocally(['https://idealista.com/1', 'https://idealista.com/2'], 'broker down');
    // Assert
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('output/audit'), { recursive: true });
    expect(appendFileSync).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('whenClosingResourcesFails_resetConnection_shouldSwallowCloseErrorsAndClearCaches', async () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    muteServiceLogger(service);
    const channel = createFakeChannel();
    const connection = createFakeConnection(channel);
    channel.close.mockRejectedValue(new Error('channel close failed'));
    connection.close.mockRejectedValue(new Error('connection close failed'));
    (service as unknown as { channel: FakeConfirmChannel | null }).channel = channel;
    (service as unknown as { connection: FakeConnection | null }).connection = connection;
    // Action
    await (service as unknown as { resetConnection: () => Promise<void> }).resetConnection();
    // Assert
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
    expect((service as unknown as { channel: FakeConfirmChannel | null }).channel).toBeNull();
    expect((service as unknown as { connection: FakeConnection | null }).connection).toBeNull();
  });

  it('whenUrlsArePublished_publishPropertyUrls_shouldSendAllUrlsAndLogSuccess', async () => {
    // Arrange
    const config = new RabbitConfigMock();
    const service = new RabbitMqService(config);
    const logger = muteServiceLogger(service);
    const channel = createFakeChannel();
    const connection = createFakeConnection(channel);
    const connectMock = connect as unknown as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(connection as never);
    // Action
    await service.publishPropertyUrls(['https://idealista.com/1', 'https://idealista.com/2']);
    // Assert
    expect(channel.assertQueue).toHaveBeenCalledWith(config.rabbitMqQueue, { durable: true });
    expect(channel.sendToQueue).toHaveBeenCalledTimes(2);
    expect(channel.waitForConfirms).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      `Published 2 property URLs to RabbitMQ queue "${config.rabbitMqQueue}".`
    );
  });

  it('whenChannelCacheExists_getChannel_shouldReturnCachedChannel', async () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const cachedChannel = createFakeChannel();
    (service as unknown as { channel: FakeConfirmChannel | null }).channel = cachedChannel;
    // Action
    const result = await (service as unknown as { getChannel: () => Promise<FakeConfirmChannel> }).getChannel();
    // Assert
    expect(result).toBe(cachedChannel);
  });

  it('whenChannelPromiseExists_getChannel_shouldReusePendingChannelPromise', async () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const pendingChannel = createFakeChannel();
    (service as unknown as { channelPromise: Promise<FakeConfirmChannel> | null }).channelPromise = Promise.resolve(pendingChannel);
    // Action
    const result = await (service as unknown as { getChannel: () => Promise<FakeConfirmChannel> }).getChannel();
    // Assert
    expect(result).toBe(pendingChannel);
  });

  it.each([
    {
      setup: (service: RabbitMqService, connection: FakeConnection) => {
        (service as unknown as { connection: FakeConnection | null }).connection = connection;
      }
    },
    {
      setup: (service: RabbitMqService, connection: FakeConnection) => {
        (service as unknown as { connectionPromise: Promise<FakeConnection> | null }).connectionPromise = Promise.resolve(connection);
      }
    }
  ])('whenConnectionCacheIsAvailable_getConnection_shouldReturnCachedConnection', async ({ setup }) => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const connection = createFakeConnection(createFakeChannel());
    setup(service, connection);
    // Action
    const result = await (service as unknown as { getConnection: () => Promise<FakeConnection> }).getConnection();
    // Assert
    expect(result).toBe(connection);
  });

  it.each([
    {
      active: true,
      expectedWarnings: 1
    },
    {
      active: false,
      expectedWarnings: 0
    }
  ])('whenConnectionErrorEventOccurs_attachConnectionLifecycleHandlers_shouldHandleOnlyActiveConnection', ({ active, expectedWarnings }) => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const connection = createFakeConnection(createFakeChannel());
    const otherConnection = createFakeConnection(createFakeChannel());
    (service as unknown as { connection: FakeConnection | null }).connection = active ? connection : otherConnection;
    (service as unknown as { attachConnectionLifecycleHandlers: (conn: FakeConnection) => void }).attachConnectionLifecycleHandlers(connection);
    // Action
    connection.emit('error', new Error('network'));
    // Assert
    expect(logger.warn).toHaveBeenCalledTimes(expectedWarnings);
  });

  it('whenConnectionCloseEventIsFromStaleConnection_attachConnectionLifecycleHandlers_shouldIgnoreIt', () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const channel = createFakeChannel();
    const activeConnection = createFakeConnection(channel);
    const staleConnection = createFakeConnection(channel);
    (service as unknown as { connection: FakeConnection | null }).connection = activeConnection;
    (service as unknown as { attachConnectionLifecycleHandlers: (conn: FakeConnection) => void }).attachConnectionLifecycleHandlers(staleConnection);
    // Action
    staleConnection.emit('close');
    // Assert
    expect((service as unknown as { connection: FakeConnection | null }).connection).toBe(activeConnection);
    expect(logger.warn).not.toHaveBeenCalledWith('RabbitMQ connection closed. Next publish will reconnect automatically.');
  });

  it('whenConnectionCloseEventOccursDuringShutdown_attachConnectionLifecycleHandlers_shouldSkipCloseWarning', () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const connection = createFakeConnection(createFakeChannel());
    (service as unknown as { shuttingDown: boolean }).shuttingDown = true;
    (service as unknown as { connection: FakeConnection | null }).connection = connection;
    (service as unknown as { attachConnectionLifecycleHandlers: (conn: FakeConnection) => void }).attachConnectionLifecycleHandlers(connection);
    // Action
    connection.emit('close');
    // Assert
    expect((service as unknown as { connection: FakeConnection | null }).connection).toBeNull();
    expect(logger.warn).not.toHaveBeenCalledWith('RabbitMQ connection closed. Next publish will reconnect automatically.');
  });

  it('whenChannelCloseEventOccursDuringShutdown_attachChannelLifecycleHandlers_shouldSkipCloseWarning', () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const channel = createFakeChannel();
    (service as unknown as { shuttingDown: boolean }).shuttingDown = true;
    (service as unknown as { channel: FakeConfirmChannel | null }).channel = channel;
    (service as unknown as { attachChannelLifecycleHandlers: (ch: FakeConfirmChannel) => void }).attachChannelLifecycleHandlers(channel);
    // Action
    channel.emit('close');
    // Assert
    expect((service as unknown as { channel: FakeConfirmChannel | null }).channel).toBeNull();
    expect(logger.warn).not.toHaveBeenCalledWith('RabbitMQ channel closed. Next publish will recreate it.');
  });

  it('whenChannelPromiseChangesBeforeResolution_getChannel_shouldKeepCurrentPromiseReference', async () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const channel = createFakeChannel();
    const delayedChannel = new Promise<FakeConfirmChannel>((resolve) => {
      setTimeout(() => resolve(channel), 0);
    });
    const connection = createFakeConnection(channel);
    connection.createConfirmChannel = jest.fn(() => delayedChannel);
    jest.spyOn(service as unknown as { getConnection: () => Promise<FakeConnection> }, 'getConnection')
      .mockResolvedValue(connection);
    const replacementPromise = Promise.resolve(createFakeChannel());
    // Action
    const pending = (service as unknown as { getChannel: () => Promise<FakeConfirmChannel> }).getChannel();
    (service as unknown as { channelPromise: Promise<FakeConfirmChannel> | null }).channelPromise = replacementPromise;
    await pending;
    // Assert
    expect((service as unknown as { channelPromise: Promise<FakeConfirmChannel> | null }).channelPromise).toBe(replacementPromise);
  });

  it('whenConnectionPromiseChangesBeforeResolution_getConnection_shouldKeepCurrentPromiseReference', async () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const channel = createFakeChannel();
    const connection = createFakeConnection(channel);
    const connectMock = connect as unknown as jest.MockedFunction<typeof connect>;
    const delayedConnection = new Promise<FakeConnection>((resolve) => {
      setTimeout(() => resolve(connection), 0);
    });
    connectMock.mockResolvedValue(delayedConnection as never);
    const replacementPromise = Promise.resolve(createFakeConnection(createFakeChannel()));
    // Action
    const pending = (service as unknown as { getConnection: () => Promise<FakeConnection> }).getConnection();
    (service as unknown as { connectionPromise: Promise<FakeConnection> | null }).connectionPromise = replacementPromise;
    await pending;
    // Assert
    expect((service as unknown as { connectionPromise: Promise<FakeConnection> | null }).connectionPromise).toBe(replacementPromise);
  });

  it('whenConnectionBlockedAndUnblocked_attachConnectionLifecycleHandlers_shouldLogBrokerState', () => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const connection = createFakeConnection(createFakeChannel());
    (service as unknown as { connection: FakeConnection | null }).connection = connection;
    (service as unknown as { attachConnectionLifecycleHandlers: (conn: FakeConnection) => void }).attachConnectionLifecycleHandlers(connection);
    // Action
    connection.emit('blocked', 'memory alarm');
    connection.emit('unblocked');
    // Assert
    expect(logger.warn).toHaveBeenCalledWith('RabbitMQ connection blocked by broker: memory alarm');
    expect(logger.log).toHaveBeenCalledWith('RabbitMQ connection unblocked by broker.');
  });

  it.each([
    {
      active: true,
      expectedWarnings: 1
    },
    {
      active: false,
      expectedWarnings: 0
    }
  ])('whenChannelErrorEventOccurs_attachChannelLifecycleHandlers_shouldHandleOnlyActiveChannel', ({ active, expectedWarnings }) => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const channel = createFakeChannel();
    const otherChannel = createFakeChannel();
    (service as unknown as { channel: FakeConfirmChannel | null }).channel = active ? channel : otherChannel;
    (service as unknown as { attachChannelLifecycleHandlers: (ch: FakeConfirmChannel) => void }).attachChannelLifecycleHandlers(channel);
    // Action
    channel.emit('error', new Error('channel'));
    // Assert
    expect(logger.warn).toHaveBeenCalledTimes(expectedWarnings);
  });

  it.each([
    {
      active: true,
      expectedWarnings: 1
    },
    {
      active: false,
      expectedWarnings: 0
    }
  ])('whenChannelCloseEventOccurs_attachChannelLifecycleHandlers_shouldHandleOnlyActiveChannel', ({ active, expectedWarnings }) => {
    // Arrange
    const service = new RabbitMqService(new RabbitConfigMock());
    const logger = muteServiceLogger(service);
    const channel = createFakeChannel();
    const otherChannel = createFakeChannel();
    (service as unknown as { channel: FakeConfirmChannel | null }).channel = active ? channel : otherChannel;
    (service as unknown as { attachChannelLifecycleHandlers: (ch: FakeConfirmChannel) => void }).attachChannelLifecycleHandlers(channel);
    // Action
    channel.emit('close');
    // Assert
    expect(logger.warn).toHaveBeenCalledTimes(expectedWarnings);
  });
});
