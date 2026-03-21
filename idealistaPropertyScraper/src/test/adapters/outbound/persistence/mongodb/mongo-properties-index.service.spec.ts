import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MongoServerError } from 'mongodb';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';
import { MongoPropertiesIndexService } from 'adapters/outbound/persistence/mongodb/mongo-properties-index.service';

class MongoDatabaseConnectionServiceMock {
  readonly getDatabase = jest.fn<() => Promise<unknown>>();
}

function createService(connectionService: MongoDatabaseConnectionServiceMock = new MongoDatabaseConnectionServiceMock()) {
  const service = new MongoPropertiesIndexService(connectionService as unknown as MongoDatabaseConnectionService);
  return { service, connectionService };
}

describe('MongoPropertiesIndexService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenPropertiesCollectionDoesNotExist_ensurePropertiesCollectionAndUrlIndex_shouldCreateCollectionAndEnsureUniqueIndex', async () => {
    // Arrange
    const { service, connectionService } = createService();
    const collection = { name: 'properties' };
    const database = {
      listCollections: jest.fn(() => ({ hasNext: async () => false })),
      createCollection: jest.fn(async () => undefined),
      collection: jest.fn(() => collection)
    };
    connectionService.getDatabase.mockResolvedValue(database);
    const ensureUniqueSpy = jest.spyOn(
      service as unknown as { ensureUniqueUrlIndex: (value: unknown) => Promise<void> },
      'ensureUniqueUrlIndex'
    ).mockResolvedValue(undefined);
    // Action
    await service.ensurePropertiesCollectionAndUrlIndex();
    // Assert
    expect(database.createCollection as unknown as jest.Mock).toHaveBeenCalledWith('properties');
    expect(ensureUniqueSpy).toHaveBeenCalledWith(collection);
  });

  it('whenPropertiesCollectionAlreadyExists_ensurePropertiesCollectionAndUrlIndex_shouldSkipCollectionCreation', async () => {
    // Arrange
    const { service, connectionService } = createService();
    const collection = { name: 'properties' };
    const database = {
      listCollections: jest.fn(() => ({ hasNext: async () => true })),
      createCollection: jest.fn(async () => undefined),
      collection: jest.fn(() => collection)
    };
    connectionService.getDatabase.mockResolvedValue(database);
    const ensureUniqueSpy = jest.spyOn(
      service as unknown as { ensureUniqueUrlIndex: (value: unknown) => Promise<void> },
      'ensureUniqueUrlIndex'
    ).mockResolvedValue(undefined);
    // Action
    await service.ensurePropertiesCollectionAndUrlIndex();
    // Assert
    expect(database.createCollection).not.toHaveBeenCalled();
    expect(ensureUniqueSpy).toHaveBeenCalledWith(collection);
  });

  it('whenUniqueUrlIndexAlreadyExists_ensureUniqueUrlIndex_shouldSkipIndexChanges', async () => {
    // Arrange
    const collection = {
      indexes: jest.fn(async () => [{ name: 'url_1', key: { url: 1 }, unique: true }]),
      dropIndex: jest.fn(async () => undefined),
      createIndex: jest.fn(async () => 'url_1')
    };
    const { service } = createService();
    // Action
    await (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it('whenNonUniqueUrlIndexesExist_ensureUniqueUrlIndex_shouldDropAndRecreateUniqueIndex', async () => {
    // Arrange
    const collection = {
      indexes: jest.fn(async () => [
        { name: '_id_', key: { _id: 1 }, unique: true },
        { name: 'url_old', key: { url: 1 }, unique: false }
      ]),
      dropIndex: jest.fn(async () => undefined),
      createIndex: jest.fn(async () => 'url_1')
    };
    const { service } = createService();
    // Action
    await (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    expect(collection.dropIndex as unknown as jest.Mock).toHaveBeenCalledWith('url_old');
    expect(collection.createIndex as unknown as jest.Mock).toHaveBeenCalledWith({ url: 1 }, { name: 'url_1', unique: true });
  });

  it('whenUrlIndexNameIsInternalId_ensureUniqueUrlIndex_shouldSkipDropForInternalName', async () => {
    // Arrange
    const collection = {
      indexes: jest.fn(async () => [
        { name: '_id_', key: { _id: 1 }, unique: true },
        { name: '_id_', key: { url: 1 }, unique: false }
      ]),
      dropIndex: jest.fn(async () => undefined),
      createIndex: jest.fn(async () => 'url_1')
    };
    const { service } = createService();
    // Action
    await (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex as unknown as jest.Mock).toHaveBeenCalledWith(
      { url: 1 },
      { name: 'url_1', unique: true }
    );
  });

  it('whenUniqueIndexCreationFailsByDuplicates_ensureUniqueUrlIndex_shouldThrowDeduplicationError', async () => {
    // Arrange
    const duplicateError = new MongoServerError({ ok: 0, code: 11000, errmsg: 'duplicate' });
    const collection = {
      indexes: jest.fn(async () => [{ name: '_id_', key: { _id: 1 }, unique: true }]),
      dropIndex: jest.fn(async () => undefined),
      createIndex: jest.fn(async () => {
        throw duplicateError;
      })
    };
    const { service } = createService();
    // Action
    const action = (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    await expect(action).rejects.toThrow(
      'Cannot create unique index on properties.url because duplicate URLs already exist. Deduplicate collection first.'
    );
  });

  it('whenCreateUniqueIndexFailsWithUnexpectedError_ensureUniqueUrlIndex_shouldRethrowOriginalError', async () => {
    // Arrange
    const unexpectedError = new Error('network issue');
    const collection = {
      indexes: jest.fn(async () => []),
      dropIndex: jest.fn(async () => undefined),
      createIndex: jest.fn(async () => {
        throw unexpectedError;
      })
    };
    const { service } = createService();
    // Action
    const action = (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    await expect(action).rejects.toBe(unexpectedError);
  });
});
