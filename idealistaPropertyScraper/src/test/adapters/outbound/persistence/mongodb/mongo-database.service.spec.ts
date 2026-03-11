import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MongoServerError } from 'mongodb';
import * as mongodb from 'mongodb';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { Property } from 'src/domain/property/property.model';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { MongoConfig } from 'src/infrastructure/config/settings/mongo.config';
import { ChromeConfigMock } from '../../../../support/mocks/chrome-config.mock';
import { MongoConfigMock } from '../../../../support/mocks/mongo-config.mock';
import { sleep } from 'src/infrastructure/sleep';

jest.mock('src/infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

type MockCollection = {
  updateOne: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
};

function createProperty(url: string, propertyId: string | null = null): Property {
  return new Property(
    propertyId,
    url,
    'Title',
    'Madrid',
    1000,
    new PropertyMainFeatures('80m2', '2', '2nd', []),
    'Comment',
    [new PropertyFeatureGroup('General', ['a'])],
    'today',
    [new PropertyImage('https://img/1.jpg', null)]
  );
}

function createService(collection: MockCollection): MongoDatabaseService {
  const service = new MongoDatabaseService(
    new ChromeConfigMock() as unknown as ChromeConfig,
    new MongoConfigMock() as unknown as MongoConfig
  );
  (service as unknown as { ensurePropertiesCollection: () => Promise<MockCollection> }).ensurePropertiesCollection = async () => collection;
  return service;
}

function createRawService(): MongoDatabaseService {
  return new MongoDatabaseService(
    new ChromeConfigMock() as unknown as ChromeConfig,
    new MongoConfigMock() as unknown as MongoConfig
  );
}

describe('MongoDatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenPropertyIsNew_saveProperty_shouldUpsertAndReturnIsNewTrue', async () => {
    // Arrange
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ upsertedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    // Action
    const result = await service.saveProperty(createProperty('https://www.idealista.com/inmueble/123456789/', null));
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: 'https://www.idealista.com/inmueble/123456789/' },
      expect.objectContaining({
        $set: expect.objectContaining({ propertyId: '123456789' })
      }),
      { upsert: true }
    );
    expect(result).toEqual({ isNew: true });
  });

  it('whenPropertyAlreadyExists_saveProperty_shouldReturnIsNewFalse', async () => {
    // Arrange
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ upsertedCount: 0 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    // Action
    const result = await service.saveProperty(createProperty('https://www.idealista.com/inmueble/123456789/', '123456789'));
    // Assert
    expect(collection.updateOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ isNew: false });
  });

  it('whenDuplicateKeyErrorOccurs_saveProperty_shouldRetryWithUpsertDisabled', async () => {
    // Arrange
    const duplicateError = new Error('E11000 duplicate key');
    const updateOne = jest.fn();
    updateOne.mockImplementationOnce(async () => {
      throw duplicateError;
    });
    updateOne.mockImplementationOnce(async () => ({ modifiedCount: 1 }));
    const collection: MockCollection = {
      updateOne,
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError = (error) => error === duplicateError;
    // Action
    const result = await service.saveProperty(createProperty('https://www.idealista.com/inmueble/1/', '1'));
    // Assert
    expect(collection.updateOne).toHaveBeenNthCalledWith(1, { url: 'https://www.idealista.com/inmueble/1/' }, expect.any(Object), { upsert: true });
    expect(collection.updateOne).toHaveBeenNthCalledWith(2, { url: 'https://www.idealista.com/inmueble/1/' }, expect.any(Object), { upsert: false });
    expect(result).toEqual({ isNew: false });
  });

  it('whenClosedPropertyIsSaved_saveClosedProperty_shouldSetClosedByAndInsertMetadata', async () => {
    // Arrange
    const closedBy = new Date('2026-03-08T12:00:00.000Z');
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    // Action
    await service.saveClosedProperty('https://www.idealista.com/inmueble/987654321/', closedBy);
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: 'https://www.idealista.com/inmueble/987654321/' },
      expect.objectContaining({
        $set: { closedBy },
        $setOnInsert: expect.objectContaining({ propertyId: '987654321' })
      }),
      { upsert: true }
    );
  });

  it('whenClosedByIsNotProvided_saveClosedProperty_shouldUseCurrentDateAsFallback', async () => {
    // Arrange
    jest.useFakeTimers();
    const now = new Date('2026-03-08T20:00:00.000Z');
    jest.setSystemTime(now);
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    // Action
    await service.saveClosedProperty('https://www.idealista.com/inmueble/999999999/');
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: 'https://www.idealista.com/inmueble/999999999/' },
      expect.objectContaining({
        $set: { closedBy: now }
      }),
      { upsert: true }
    );
    jest.useRealTimers();
  });

  it.each([
    {
      method: 'propertyExistsByUrl',
      findOneResult: { _id: 1 },
      expected: true
    },
    {
      method: 'propertyExistsByUrl',
      findOneResult: null,
      expected: false
    },
    {
      method: 'isOpenPropertyByUrl',
      findOneResult: { _id: 1 },
      expected: true
    },
    {
      method: 'isOpenPropertyByUrl',
      findOneResult: null,
      expected: false
    }
  ])('whenUrlExistenceIsChecked_$method_shouldReturnExpectedBoolean', async ({ method, findOneResult, expected }) => {
    // Arrange
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => findOneResult),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    // Action
    const result = await (service as unknown as Record<string, (url: string) => Promise<boolean>>)[method]('https://url');
    // Assert
    expect(result).toBe(expected);
  });

  it('whenTouchReceivesBlankUrl_touchPropertyLastTimeVisited_shouldSkipUpdate', async () => {
    // Arrange
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    // Action
    await service.touchPropertyLastTimeVisited('   ');
    // Assert
    expect(collection.updateOne).not.toHaveBeenCalled();
  });

  it('whenOpenUrlsAreFetched_getOpenPropertyUrls_shouldReturnTrimmedNonEmptyUrls', async () => {
    // Arrange
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({
        toArray: async () => [
          { url: ' https://a ' },
          { url: '' },
          { url: 'https://b' },
          { url: 123 }
        ]
      }))
    };
    const service = createService(collection);
    // Action
    const urls = await service.getOpenPropertyUrls();
    // Assert
    expect(urls).toEqual(['https://a', 'https://b']);
  });

  it('whenMissingLastTimeVisitedUrlsAreFetched_getOpenPropertyUrlsWithoutLastTimeVisited_shouldReturnTrimmedNonEmptyUrls', async () => {
    // Arrange
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({
        toArray: async () => [
          { url: ' https://a ' },
          { url: null },
          { url: 'https://b' }
        ]
      }))
    };
    const service = createService(collection);
    // Action
    const urls = await service.getOpenPropertyUrlsWithoutLastTimeVisited();
    // Assert
    expect(urls).toEqual(['https://a', 'https://b']);
  });

  it('whenStringPricesAreFixed_fixStringPricesToNumbers_shouldTrackUpdatedSkippedAndFailedCounters', async () => {
    // Arrange
    const documents = [
      { _id: '1', price: '1.200 EUR' },
      { _id: '2', price: 'N/A' },
      { _id: '3', price: '700' }
    ];
    const cursor = {
      async *[Symbol.asyncIterator](): AsyncGenerator<{ _id: string; price: string }> {
        for (const document of documents) {
          yield document;
        }
      }
    };
    const updateOne = jest.fn();
    updateOne.mockImplementationOnce(async () => ({ modifiedCount: 1 }));
    updateOne.mockImplementationOnce(async () => {
      throw new Error('write failure');
    });
    const collection: MockCollection = {
      updateOne,
      findOne: jest.fn(async () => null),
      find: jest.fn(() => cursor as unknown as { toArray: () => Promise<Array<Record<string, unknown>>> })
    };
    const service = createService(collection);
    // Action
    const result = await service.fixStringPricesToNumbers();
    // Assert
    expect(result).toEqual({
      scanned: 3,
      updated: 1,
      skipped: 1,
      failed: 1
    });
  });

  it('whenMongoClientExists_onModuleDestroy_shouldCloseClientAndResetReferences', async () => {
    // Arrange
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    const close = jest.fn(async () => undefined);
    (service as unknown as { mongoClient: { close: () => Promise<void> } }).mongoClient = { close };
    (service as unknown as { database: object }).database = {};
    (service as unknown as { propertiesCollection: object }).propertiesCollection = {};
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
    const service = createRawService();
    // Action
    await service.onModuleDestroy();
    // Assert
    expect((service as unknown as { mongoClient?: unknown }).mongoClient).toBeUndefined();
    expect((service as unknown as { database?: unknown }).database).toBeUndefined();
    expect((service as unknown as { propertiesCollection?: unknown }).propertiesCollection).toBeUndefined();
  });

  it('whenUniqueUrlIndexAlreadyExists_ensureUniqueUrlIndex_shouldSkipIndexChanges', async () => {
    // Arrange
    const collection = {
      indexes: jest.fn(async () => [{ name: 'url_1', key: { url: 1 }, unique: true }]),
      dropIndex: jest.fn(async () => undefined),
      createIndex: jest.fn(async () => 'url_1')
    };
    const service = createService({
      updateOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn()
    });
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
    const service = createService({
      updateOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn()
    });
    // Action
    await (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    expect(collection.dropIndex as unknown as jest.Mock).toHaveBeenCalledWith('url_old');
    expect(collection.createIndex as unknown as jest.Mock).toHaveBeenCalledWith({ url: 1 }, { name: 'url_1', unique: true });
  });

  it('whenUniqueIndexCreationFailsByDuplicates_ensureUniqueUrlIndex_shouldThrowDeduplicationError', async () => {
    // Arrange
    const duplicate = new Error('duplicate');
    const collection = {
      indexes: jest.fn(async () => [{ name: '_id_', key: { _id: 1 }, unique: true }]),
      dropIndex: jest.fn(async () => undefined),
      createIndex: jest.fn(async () => {
        throw duplicate;
      })
    };
    const service = createService({
      updateOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn()
    });
    (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError = (error) => error === duplicate;
    // Action
    const action = (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    await expect(action).rejects.toThrow('Cannot create unique index on properties.url because duplicate URLs already exist. Deduplicate collection first.');
  });

  it('whenMongoValidationFailsThenSucceeds_validateConnectionOrExit_shouldRetryAfterSleep', async () => {
    // Arrange
    const service = createService({
      updateOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn()
    });
    const ensureSpy = jest.spyOn(
      service as unknown as { ensurePropertiesCollectionAndUrlIndex: () => Promise<void> },
      'ensurePropertiesCollectionAndUrlIndex'
    ).mockResolvedValue(undefined);
    let attempts = 0;
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('connection fail');
      }
      (service as unknown as {
        mongoClient?: { db: (name: string) => { command: (query: unknown) => Promise<void> } };
      }).mongoClient = {
        db: () => ({
          command: async () => undefined
        })
      };
    });
    // Action
    await service.validateConnectionOrExit();
    // Assert
    expect((sleep as jest.Mock)).toHaveBeenCalled();
    expect(ensureSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { input: null, expected: null },
    { input: 'abc', expected: null },
    { input: '1.200 EUR', expected: 1200 },
    { input: '9'.repeat(5000), expected: null }
  ])('whenParsingStringPrice_parseStringPriceToNumber_shouldReturnExpectedNumber', ({ input, expected }) => {
    // Arrange
    const service = createService({
      updateOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn()
    });
    // Action
    const result = (service as unknown as { parseStringPriceToNumber: (value: unknown) => number | null })
      .parseStringPriceToNumber(input);
    // Assert
    expect(result).toBe(expected);
  });

  it('whenUnexpectedWriteErrorOccurs_saveProperty_shouldRethrowError', async () => {
    // Arrange
    const genericError = new Error('write failed');
    const collection: MockCollection = {
      updateOne: jest.fn(async () => {
        throw genericError;
      }),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError = () => false;
    // Action
    const action = service.saveProperty(createProperty('https://www.idealista.com/inmueble/200/', '200'));
    // Assert
    await expect(action).rejects.toBe(genericError);
  });

  it('whenTouchReceivesValidUrl_touchPropertyLastTimeVisited_shouldTrimAndUpdateDocument', async () => {
    // Arrange
    const visitedAt = new Date('2026-03-08T18:00:00.000Z');
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ toArray: async () => [] }))
    };
    const service = createService(collection);
    // Action
    await service.touchPropertyLastTimeVisited('  https://www.idealista.com/inmueble/123/  ', visitedAt);
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: 'https://www.idealista.com/inmueble/123/' },
      { $set: { lastTimeVisited: visitedAt } }
    );
  });

  it('whenPriceUpdateDoesNotModifyDocument_fixStringPricesToNumbers_shouldCountItAsSkipped', async () => {
    // Arrange
    const cursor = {
      async *[Symbol.asyncIterator](): AsyncGenerator<{ _id: string; price: string }> {
        yield { _id: '1', price: '1.200 EUR' };
      }
    };
    const collection: MockCollection = {
      updateOne: jest.fn(async () => ({ modifiedCount: 0 })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => cursor as unknown as { toArray: () => Promise<Array<Record<string, unknown>>> })
    };
    const service = createService(collection);
    // Action
    const result = await service.fixStringPricesToNumbers();
    // Assert
    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1, failed: 0 });
  });

  it('whenAdminHandleIsMissing_validateConnectionOrExit_shouldRetryUntilAdminPingIsAvailable', async () => {
    // Arrange
    const service = createRawService();
    const ensureSpy = jest.spyOn(
      service as unknown as { ensurePropertiesCollectionAndUrlIndex: () => Promise<void> },
      'ensurePropertiesCollectionAndUrlIndex'
    ).mockResolvedValue(undefined);
    let attempts = 0;
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) {
        (service as unknown as { mongoClient?: { db: () => undefined } }).mongoClient = { db: () => undefined };
        return;
      }
      (service as unknown as {
        mongoClient?: { db: () => { command: (command: unknown) => Promise<void> } };
      }).mongoClient = {
        db: () => ({
          command: async () => undefined
        })
      };
    });
    // Action
    await service.validateConnectionOrExit();
    // Assert
    expect((sleep as jest.Mock)).toHaveBeenCalledTimes(1);
    expect(ensureSpy).toHaveBeenCalledTimes(1);
  });

  it('whenCollectionIsMissing_ensurePropertiesCollection_shouldInvokeConnectAndReturnCollection', async () => {
    // Arrange
    const service = createRawService();
    const collection = { updateOne: jest.fn(), findOne: jest.fn(), find: jest.fn() };
    const connectSpy = jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockImplementation(async () => {
      (service as unknown as { propertiesCollection?: unknown }).propertiesCollection = collection;
    });
    // Action
    const result = await (service as unknown as { ensurePropertiesCollection: () => Promise<unknown> }).ensurePropertiesCollection();
    // Assert
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(collection);
  });

  it('whenCollectionIsAlreadyInitialized_ensurePropertiesCollection_shouldReturnCollectionWithoutConnect', async () => {
    // Arrange
    const service = createRawService();
    const collection = { marker: 'existing-collection' };
    (service as unknown as { propertiesCollection?: unknown }).propertiesCollection = collection;
    const connectSpy = jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    );
    // Action
    const result = await (service as unknown as { ensurePropertiesCollection: () => Promise<unknown> }).ensurePropertiesCollection();
    // Assert
    expect(result).toBe(collection);
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('whenCollectionStillMissingAfterConnect_ensurePropertiesCollection_shouldThrowInitializationError', async () => {
    // Arrange
    const service = createRawService();
    jest.spyOn(
      service as unknown as { connect: () => Promise<void> },
      'connect'
    ).mockResolvedValue(undefined);
    // Action
    const action = (service as unknown as { ensurePropertiesCollection: () => Promise<unknown> }).ensurePropertiesCollection();
    // Assert
    await expect(action).rejects.toThrow('MongoDB collection is not initialized.');
  });

  it('whenDatabaseIsNotInitialized_ensurePropertiesCollectionAndUrlIndex_shouldThrowError', async () => {
    // Arrange
    const service = createRawService();
    // Action
    const action = (service as unknown as { ensurePropertiesCollectionAndUrlIndex: () => Promise<void> }).ensurePropertiesCollectionAndUrlIndex();
    // Assert
    await expect(action).rejects.toThrow('MongoDB database is not initialized.');
  });

  it('whenPropertiesCollectionDoesNotExist_ensurePropertiesCollectionAndUrlIndex_shouldCreateCollectionAndEnsureUniqueIndex', async () => {
    // Arrange
    const service = createRawService();
    const collection = { name: 'properties' };
    const database = {
      listCollections: jest.fn(() => ({ hasNext: async () => false })),
      createCollection: jest.fn(async () => undefined),
      collection: jest.fn(() => collection)
    };
    (service as unknown as { database?: unknown }).database = database;
    const ensureUniqueSpy = jest.spyOn(
      service as unknown as { ensureUniqueUrlIndex: (value: unknown) => Promise<void> },
      'ensureUniqueUrlIndex'
    ).mockResolvedValue(undefined);
    // Action
    await (service as unknown as { ensurePropertiesCollectionAndUrlIndex: () => Promise<void> }).ensurePropertiesCollectionAndUrlIndex();
    // Assert
    expect(database.createCollection as unknown as jest.Mock).toHaveBeenCalledWith('properties');
    expect(ensureUniqueSpy).toHaveBeenCalledWith(collection);
    expect((service as unknown as { propertiesCollection?: unknown }).propertiesCollection).toBe(collection);
  });

  it('whenPropertiesCollectionAlreadyExists_ensurePropertiesCollectionAndUrlIndex_shouldSkipCollectionCreation', async () => {
    // Arrange
    const service = createRawService();
    const collection = { name: 'properties' };
    const database = {
      listCollections: jest.fn(() => ({ hasNext: async () => true })),
      createCollection: jest.fn(async () => undefined),
      collection: jest.fn(() => collection)
    };
    (service as unknown as { database?: unknown }).database = database;
    const ensureUniqueSpy = jest.spyOn(
      service as unknown as { ensureUniqueUrlIndex: (value: unknown) => Promise<void> },
      'ensureUniqueUrlIndex'
    ).mockResolvedValue(undefined);
    // Action
    await (service as unknown as { ensurePropertiesCollectionAndUrlIndex: () => Promise<void> }).ensurePropertiesCollectionAndUrlIndex();
    // Assert
    expect(database.createCollection as unknown as jest.Mock).not.toHaveBeenCalled();
    expect(ensureUniqueSpy).toHaveBeenCalledWith(collection);
    expect((service as unknown as { propertiesCollection?: unknown }).propertiesCollection).toBe(collection);
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
    const service = createRawService();
    (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError = () => false;
    // Action
    const action = (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    await expect(action).rejects.toBe(unexpectedError);
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
    const service = createRawService();
    // Action
    await (service as unknown as { ensureUniqueUrlIndex: (col: typeof collection) => Promise<void> }).ensureUniqueUrlIndex(collection);
    // Assert
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex as unknown as jest.Mock).toHaveBeenCalledWith(
      { url: 1 },
      { name: 'url_1', unique: true }
    );
  });

  it('whenErrorIsMongoServerDuplicateKey_isDuplicateKeyError_shouldReturnExpectedBoolean', () => {
    // Arrange
    const duplicateError = new MongoServerError({ ok: 0, code: 11000, errmsg: 'duplicate' });
    const genericError = new Error('other');
    const service = createRawService();
    // Action
    const duplicateResult = (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError(duplicateError);
    const genericResult = (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError(genericError);
    // Assert
    expect(duplicateResult).toBe(true);
    expect(genericResult).toBe(false);
  });

  it('whenMongoConnectionIsAlreadyInitialized_connect_shouldReturnWithoutRecreatingClient', async () => {
    // Arrange
    const service = createRawService();
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
    const service = createRawService();
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

  it.each([
    { input: '   ' },
    { input: 'https://www.idealista.com/alquiler-viviendas/madrid/' }
  ])('whenUrlHasNoPropertyId_extractPropertyIdFromUrl_shouldReturnNull', ({ input }) => {
    // Arrange
    const service = createRawService();
    // Action
    const result = (service as unknown as { extractPropertyIdFromUrl: (url: string) => string | null }).extractPropertyIdFromUrl(input);
    // Assert
    expect(result).toBeNull();
  });
});
