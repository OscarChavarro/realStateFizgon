import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Collection } from 'mongodb';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';
import { MongoDatabaseService } from 'adapters/outbound/persistence/mongodb/mongo-database.service';
import { MongoPropertyDocument } from 'adapters/outbound/persistence/mongodb/mongo-property.document';
import { PriceFixSummary } from 'adapters/outbound/persistence/mongodb/mongo-price-migration.service';
import { Property } from 'domain/property/property';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { SavePropertyResult } from 'ports/outbound/persistence/save-property-result.type';

type PropertiesCollection = Collection<MongoPropertyDocument>;

class MongoDatabaseConnectionServiceMock {
  readonly getPropertiesCollection = jest.fn<() => Promise<PropertiesCollection>>();
}

class MongoPriceMigrationServiceMock {
  readonly fixStringPricesToNumbers = jest.fn<
    (collection: PropertiesCollection) => Promise<PriceFixSummary>
  >();
}

class MongoPropertyUpsertServiceMock {
  readonly saveProperty = jest.fn<
    (collection: PropertiesCollection, property: Property) => Promise<SavePropertyResult>
  >();
}

class MongoPropertyVisitServiceMock {
  readonly touchPropertyLastTimeVisited = jest.fn<
    (collection: PropertiesCollection, url: string, visitedAt?: Date) => Promise<void>
  >();
  readonly getOpenPropertyUrlsWithoutLastTimeVisited = jest.fn<
    (collection: PropertiesCollection) => Promise<string[]>
  >();
  readonly getOpenPropertyUrls = jest.fn<
    (collection: PropertiesCollection) => Promise<string[]>
  >();
}

function createProperty(url: string, propertyId: string | null = null): Property {
  return Property.create({
    propertyId,
    url,
    title: 'Title',
    location: 'Madrid',
    price: 1000,
    mainFeatures: new PropertyMainFeatures('80m2', '2', '2nd', []),
    advertiserComment: 'Comment',
    featureGroups: [new PropertyFeatureGroup('General', ['a'])],
    publicationAge: 'today',
    images: [new PropertyImage('https://img/1.jpg', null)]
  });
}

function createCollectionMock(findOneResult: unknown = null): PropertiesCollection {
  return {
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })) as never,
    findOne: jest.fn(async () => findOneResult) as never
  } as unknown as PropertiesCollection;
}

function createService(
  connectionService: MongoDatabaseConnectionServiceMock = new MongoDatabaseConnectionServiceMock(),
  mongoPriceMigrationService: MongoPriceMigrationServiceMock = new MongoPriceMigrationServiceMock(),
  mongoPropertyUpsertService: MongoPropertyUpsertServiceMock = new MongoPropertyUpsertServiceMock(),
  mongoPropertyVisitService: MongoPropertyVisitServiceMock = new MongoPropertyVisitServiceMock()
) {
  const service = new MongoDatabaseService(
    connectionService as unknown as MongoDatabaseConnectionService,
    mongoPriceMigrationService as never,
    mongoPropertyUpsertService as never,
    mongoPropertyVisitService as never
  );

  return {
    service,
    connectionService,
    mongoPriceMigrationService,
    mongoPropertyUpsertService,
    mongoPropertyVisitService
  };
}

describe('MongoDatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenPropertySaveIsRequested_saveProperty_shouldDelegateToMongoPropertyUpsertService', async () => {
    // Arrange
    const collection = createCollectionMock();
    const { service, connectionService, mongoPropertyUpsertService } = createService();
    const property = createProperty('https://www.idealista.com/inmueble/123456789/', null);
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    mongoPropertyUpsertService.saveProperty.mockResolvedValue({ isNew: true });
    // Action
    const result = await service.saveProperty(property);
    // Assert
    expect(connectionService.getPropertiesCollection).toHaveBeenCalledTimes(1);
    expect(mongoPropertyUpsertService.saveProperty).toHaveBeenCalledWith(collection, property);
    expect(result).toEqual({ isNew: true });
  });

  it('whenClosedPropertyIsSaved_saveClosedProperty_shouldSetClosedByAndInsertMetadata', async () => {
    // Arrange
    const closedBy = new Date('2026-03-08T12:00:00.000Z');
    const collection = createCollectionMock();
    const { service, connectionService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
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
    const collection = createCollectionMock();
    const { service, connectionService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
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
    { method: 'propertyExistsByUrl', findOneResult: { _id: 1 }, expected: true },
    { method: 'propertyExistsByUrl', findOneResult: null, expected: false },
    { method: 'isOpenPropertyByUrl', findOneResult: { _id: 1 }, expected: true },
    { method: 'isOpenPropertyByUrl', findOneResult: null, expected: false },
    { method: 'hasGeoLocationHintByUrl', findOneResult: { _id: 1 }, expected: true },
    { method: 'hasGeoLocationHintByUrl', findOneResult: null, expected: false }
  ])('whenUrlExistenceIsChecked_$method_shouldReturnExpectedBoolean', async ({ method, findOneResult, expected }) => {
    // Arrange
    const collection = createCollectionMock(findOneResult);
    const { service, connectionService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    // Action
    const result = await (service as unknown as Record<string, (url: string) => Promise<boolean>>)[method]('https://url');
    // Assert
    expect(result).toBe(expected);
  });

  it('whenCheckingGeoHintExistence_hasGeoLocationHintByUrl_shouldRequireNumericCoordinatesToAvoidSkippingNulls', async () => {
    // Arrange
    const collection = createCollectionMock();
    const { service, connectionService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    // Action
    await service.hasGeoLocationHintByUrl('https://www.idealista.com/inmueble/110906048/');
    // Assert
    expect(collection.findOne).toHaveBeenCalledWith(
      {
        url: 'https://www.idealista.com/inmueble/110906048/',
        'geoLocationHint.lat': { $type: 'number' },
        'geoLocationHint.lon': { $type: 'number' }
      },
      { projection: { _id: 1 } }
    );
  });

  it('whenLastTimeVisitedIsUpdated_touchPropertyLastTimeVisited_shouldDelegateToMongoPropertyVisitService', async () => {
    // Arrange
    const visitedAt = new Date('2026-03-08T18:00:00.000Z');
    const collection = createCollectionMock();
    const { service, connectionService, mongoPropertyVisitService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    mongoPropertyVisitService.touchPropertyLastTimeVisited.mockResolvedValue(undefined);
    // Action
    await service.touchPropertyLastTimeVisited('https://www.idealista.com/inmueble/123/', visitedAt);
    // Assert
    expect(mongoPropertyVisitService.touchPropertyLastTimeVisited).toHaveBeenCalledWith(
      collection,
      'https://www.idealista.com/inmueble/123/',
      visitedAt
    );
  });

  it('whenVisitedAtIsOmitted_touchPropertyLastTimeVisited_shouldDelegateUsingCurrentDate', async () => {
    // Arrange
    jest.useFakeTimers();
    const now = new Date('2026-03-08T18:15:00.000Z');
    jest.setSystemTime(now);
    const collection = createCollectionMock();
    const { service, connectionService, mongoPropertyVisitService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    mongoPropertyVisitService.touchPropertyLastTimeVisited.mockResolvedValue(undefined);
    // Action
    await service.touchPropertyLastTimeVisited('https://www.idealista.com/inmueble/123/');
    // Assert
    expect(mongoPropertyVisitService.touchPropertyLastTimeVisited).toHaveBeenCalledWith(
      collection,
      'https://www.idealista.com/inmueble/123/',
      now
    );
    jest.useRealTimers();
  });

  it('whenOpenUrlsAreRequested_getOpenPropertyUrls_shouldDelegateToMongoPropertyVisitServiceAndReturnResult', async () => {
    // Arrange
    const collection = createCollectionMock();
    const { service, connectionService, mongoPropertyVisitService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    mongoPropertyVisitService.getOpenPropertyUrls.mockResolvedValue(['https://a', 'https://b']);
    // Action
    const urls = await service.getOpenPropertyUrls();
    // Assert
    expect(mongoPropertyVisitService.getOpenPropertyUrls).toHaveBeenCalledWith(collection);
    expect(urls).toEqual(['https://a', 'https://b']);
  });

  it('whenOpenUrlsWithoutLastTimeVisitedAreRequested_getOpenPropertyUrlsWithoutLastTimeVisited_shouldDelegateAndReturnResult', async () => {
    // Arrange
    const collection = createCollectionMock();
    const { service, connectionService, mongoPropertyVisitService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    mongoPropertyVisitService.getOpenPropertyUrlsWithoutLastTimeVisited.mockResolvedValue(['https://a']);
    // Action
    const urls = await service.getOpenPropertyUrlsWithoutLastTimeVisited();
    // Assert
    expect(mongoPropertyVisitService.getOpenPropertyUrlsWithoutLastTimeVisited).toHaveBeenCalledWith(collection);
    expect(urls).toEqual(['https://a']);
  });

  it('whenPriceMigrationIsRequested_fixStringPricesToNumbers_shouldDelegateToMongoPriceMigrationService', async () => {
    // Arrange
    const collection = createCollectionMock();
    const { service, connectionService, mongoPriceMigrationService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    mongoPriceMigrationService.fixStringPricesToNumbers.mockResolvedValue({
      scanned: 3,
      updated: 1,
      skipped: 1,
      failed: 0
    });
    // Action
    const result = await service.fixStringPricesToNumbers();
    // Assert
    expect(mongoPriceMigrationService.fixStringPricesToNumbers).toHaveBeenCalledWith(collection);
    expect(result).toEqual({ scanned: 3, updated: 1, skipped: 1, failed: 0 });
  });

  it.each([
    { input: '   ' },
    { input: 'https://www.idealista.com/alquiler-viviendas/madrid/' }
  ])('whenUrlHasNoPropertyId_saveClosedProperty_shouldPersistNullPropertyId', async ({ input }) => {
    // Arrange
    const collection = createCollectionMock();
    const { service, connectionService } = createService();
    connectionService.getPropertiesCollection.mockResolvedValue(collection);
    // Action
    await service.saveClosedProperty(input, new Date('2026-03-08T12:00:00.000Z'));
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: input },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ propertyId: null })
      }),
      { upsert: true }
    );
  });
});
