import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MongoPropertyVisitService } from 'src/adapters/outbound/persistence/mongodb/mongo-property-visit.service';

type PropertyVisitCollectionMock = {
  updateOne: jest.Mock;
  find: jest.Mock;
};

describe('MongoPropertyVisitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenUrlIsBlank_touchPropertyLastTimeVisited_shouldSkipDatabaseUpdate', async () => {
    // Arrange
    const collection: PropertyVisitCollectionMock = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      find: jest.fn()
    };
    const service = new MongoPropertyVisitService();
    // Action
    await service.touchPropertyLastTimeVisited(collection as never, '   ');
    // Assert
    expect(collection.updateOne).not.toHaveBeenCalled();
  });

  it('whenVisitedAtIsNotProvided_touchPropertyLastTimeVisited_shouldTrimUrlAndUseCurrentDate', async () => {
    // Arrange
    jest.useFakeTimers();
    const now = new Date('2026-03-08T22:00:00.000Z');
    jest.setSystemTime(now);
    const collection: PropertyVisitCollectionMock = {
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      find: jest.fn()
    };
    const service = new MongoPropertyVisitService();
    // Action
    await service.touchPropertyLastTimeVisited(collection as never, '  https://www.idealista.com/inmueble/123/  ');
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: 'https://www.idealista.com/inmueble/123/' },
      { $set: { lastTimeVisited: now } }
    );
    jest.useRealTimers();
  });

  it('whenOpenUrlsWithoutLastTimeVisitedAreRequested_getOpenPropertyUrlsWithoutLastTimeVisited_shouldQueryAndNormalizeUrls', async () => {
    // Arrange
    const documents = [
      { url: ' https://a ' },
      { url: '' },
      { url: 'https://b' },
      { url: null },
      { url: 123 }
    ];
    const collection: PropertyVisitCollectionMock = {
      updateOne: jest.fn(),
      find: jest.fn(() => ({
        toArray: async () => documents
      }))
    };
    const service = new MongoPropertyVisitService();
    // Action
    const result = await service.getOpenPropertyUrlsWithoutLastTimeVisited(collection as never);
    // Assert
    expect(collection.find).toHaveBeenCalledWith(
      {
        closedBy: { $exists: false },
        url: { $type: 'string' },
        $or: [
          { lastTimeVisited: { $exists: false } },
          { lastTimeVisited: null }
        ]
      },
      {
        projection: { _id: 0, url: 1 }
      }
    );
    expect(result).toEqual(['https://a', 'https://b']);
  });

  it('whenOpenUrlsAreRequested_getOpenPropertyUrls_shouldQueryAndNormalizeUrls', async () => {
    // Arrange
    const documents = [
      { url: ' https://open-a ' },
      { url: '' },
      { url: undefined },
      { url: 'https://open-b' }
    ];
    const collection: PropertyVisitCollectionMock = {
      updateOne: jest.fn(),
      find: jest.fn(() => ({
        toArray: async () => documents
      }))
    };
    const service = new MongoPropertyVisitService();
    // Action
    const result = await service.getOpenPropertyUrls(collection as never);
    // Assert
    expect(collection.find).toHaveBeenCalledWith(
      {
        closedBy: { $exists: false },
        url: { $type: 'string' }
      },
      {
        projection: { _id: 0, url: 1 }
      }
    );
    expect(result).toEqual(['https://open-a', 'https://open-b']);
  });
});
