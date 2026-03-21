import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import * as mongodb from 'mongodb';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';
import { MongoConfigMock } from '../../../../support/mocks/mongo-config.mock';

function createService(): MongoDatabaseConnectionService {
  return new MongoDatabaseConnectionService(new MongoConfigMock());
}

describe('MongoDatabaseConnectionService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  it('whenMongoClientExists_onModuleDestroy_shouldCloseClientAndResetReferences', async () => {
    // Arrange
    const service = createService();
    const close = jest.fn(async () => undefined);
    (service as unknown as { mongoClient?: { close: () => Promise<void> } }).mongoClient = { close };
    (service as unknown as { database?: object }).database = {};
    (service as unknown as { propertiesCollection?: object }).propertiesCollection = {};
    // Action
    await service.onModuleDestroy();
    // Assert
    expect(close).toHaveBeenCalledTimes(1);
    expect((service as unknown as { mongoClient?: unknown }).mongoClient).toBeUndefined();
    expect((service as unknown as { database?: unknown }).database).toBeUndefined();
    expect((service as unknown as { propertiesCollection?: unknown }).propertiesCollection).toBeUndefined();
  });

  it('whenMongoClientIsMissing_onModuleDestroy_shouldReturnWithoutClosing', async () => {
    // Arrange
    const service = createService();
    // Action
    await service.onModuleDestroy();
    // Assert
    expect((service as unknown as { mongoClient?: unknown }).mongoClient).toBeUndefined();
  });

  it('whenPropertiesCollectionExists_getPropertiesCollection_shouldReturnWithoutConnecting', async () => {
    // Arrange
    const service = createService();
    const existingCollection = { marker: 'collection' };
    (service as unknown as { propertiesCollection?: unknown }).propertiesCollection = existingCollection;
    const connectSpy = jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    );
    // Action
    const result = await service.getPropertiesCollection();
    // Assert
    expect(result).toBe(existingCollection);
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('whenPropertiesCollectionIsMissing_getPropertiesCollection_shouldConnectAndReturnCollection', async () => {
    // Arrange
    const service = createService();
    const collection = { marker: 'collection' };
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockImplementation(async () => {
      (service as unknown as { propertiesCollection?: unknown }).propertiesCollection = collection;
    });
    // Action
    const result = await service.getPropertiesCollection();
    // Assert
    expect(result).toBe(collection);
  });

  it('whenCollectionStillMissingAfterConnect_getPropertiesCollection_shouldThrowInitializationError', async () => {
    // Arrange
    const service = createService();
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockResolvedValue(undefined);
    // Action
    const action = service.getPropertiesCollection();
    // Assert
    await expect(action).rejects.toThrow('MongoDB collection is not initialized.');
  });

  it('whenDatabaseStillMissingAfterConnect_getDatabase_shouldThrowInitializationError', async () => {
    // Arrange
    const service = createService();
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockResolvedValue(undefined);
    // Action
    const action = service.getDatabase();
    // Assert
    await expect(action).rejects.toThrow('MongoDB database is not initialized.');
  });

  it('whenDatabaseExists_getDatabase_shouldReturnWithoutConnecting', async () => {
    // Arrange
    const service = createService();
    const existingDatabase = { marker: 'database' };
    (service as unknown as { database?: unknown }).database = existingDatabase;
    const connectSpy = jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    );
    // Action
    const result = await service.getDatabase();
    // Assert
    expect(result).toBe(existingDatabase);
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('whenAdminHandleIsMissing_pingAdmin_shouldThrowAdminHandleError', async () => {
    // Arrange
    const service = createService();
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockImplementation(async () => {
      (service as unknown as { mongoClient?: { db: () => undefined } }).mongoClient = { db: () => undefined };
    });
    // Action
    const action = service.pingAdmin();
    // Assert
    await expect(action).rejects.toThrow('MongoDB admin database handle is not available.');
  });

  it('whenAdminHandleExists_pingAdmin_shouldSendPingCommand', async () => {
    // Arrange
    const service = createService();
    const command = jest.fn(async () => undefined);
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockImplementation(async () => {
      (service as unknown as {
        mongoClient?: { db: (name: string) => { command: (value: unknown) => Promise<void> } };
      }).mongoClient = {
        db: () => ({
          command
        })
      };
    });
    // Action
    await service.pingAdmin();
    // Assert
    expect(command as unknown as jest.Mock).toHaveBeenCalledTimes(1);
    expect(command as unknown as jest.Mock).toHaveBeenCalledWith({ ping: 1 });
  });

  it('whenMongoConnectionIsAlreadyInitialized_connect_shouldReturnWithoutRecreatingClient', async () => {
    // Arrange
    const service = createService();
    const mongoClient = { marker: 'client' };
    const database = { marker: 'db' };
    const collection = { marker: 'collection' };
    (service as unknown as { mongoClient?: unknown }).mongoClient = mongoClient;
    (service as unknown as { database?: unknown }).database = database;
    (service as unknown as { propertiesCollection?: unknown }).propertiesCollection = collection;
    // Action
    await (service as unknown as { connect: () => Promise<void> }).connect();
    // Assert
    expect((service as unknown as { mongoClient?: unknown }).mongoClient).toBe(mongoClient);
    expect((service as unknown as { database?: unknown }).database).toBe(database);
    expect((service as unknown as { propertiesCollection?: unknown }).propertiesCollection).toBe(collection);
  });

  it('whenMongoConnectionIsNotInitialized_connect_shouldCreateClientDatabaseAndCollection', async () => {
    // Arrange
    const service = createService();
    const collection = { marker: 'properties' };
    const database = {
      collection: jest.fn(() => collection)
    };
    const fakeClient = {
      connect: jest.fn(async () => undefined),
      db: jest.fn(() => database)
    };
    const mongoClientMock = jest.fn(() => fakeClient);
    const mongoClientGetterSpy = jest.spyOn(
      mongodb as unknown as { MongoClient: unknown },
      'MongoClient' as never,
      'get'
    ).mockReturnValue(mongoClientMock as unknown as never);
    // Action
    await (service as unknown as { connect: () => Promise<void> }).connect();
    // Assert
    expect(mongoClientMock as unknown as jest.Mock).toHaveBeenCalledWith((new MongoConfigMock()).mongoConnectionUri);
    expect(fakeClient.connect).toHaveBeenCalledTimes(1);
    expect(fakeClient.db as unknown as jest.Mock).toHaveBeenCalledWith((new MongoConfigMock()).mongoDatabase);
    expect(database.collection as unknown as jest.Mock).toHaveBeenCalledWith('properties');
    expect((service as unknown as { database?: unknown }).database).toBe(database);
    expect((service as unknown as { propertiesCollection?: unknown }).propertiesCollection).toBe(collection);
    mongoClientGetterSpy.mockRestore();
  });
});
