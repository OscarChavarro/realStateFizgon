import { describe, expect, it, jest } from '@jest/globals';
import { MongoServerError } from 'mongodb';
import { MongoPublicationDateMapperService } from 'src/adapters/outbound/persistence/mongodb/mongo-publication-date-mapper.service';
import { MongoPropertyUpsertService } from 'src/adapters/outbound/persistence/mongodb/mongo-property-upsert.service';
import { Property } from 'src/domain/property/property.model';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';

type UpsertCollectionMock = {
  updateOne: jest.Mock;
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
    'Anuncio actualizado hace 10 días',
    [new PropertyImage('https://img/1.jpg', null)]
  );
}

function createService(): MongoPropertyUpsertService {
  return new MongoPropertyUpsertService(new MongoPublicationDateMapperService());
}

describe('MongoPropertyUpsertService', () => {
  it('whenPropertyIsNew_saveProperty_shouldUpsertAndReturnIsNewTrue', async () => {
    // Arrange
    const collection: UpsertCollectionMock = {
      updateOne: jest.fn(async () => ({ upsertedCount: 1 }))
    };
    const service = createService();
    // Action
    const result = await service.saveProperty(collection as never, createProperty('https://www.idealista.com/inmueble/123456789/', null));
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: 'https://www.idealista.com/inmueble/123456789/' },
      expect.objectContaining({
        $set: expect.objectContaining({ propertyId: '123456789' }),
        $setOnInsert: expect.objectContaining({
          importedBy: expect.any(Date),
          publicationDate: expect.any(Date)
        })
      }),
      { upsert: true }
    );
    expect(result).toEqual({ isNew: true });
  });

  it('whenPropertyAlreadyExists_saveProperty_shouldReturnIsNewFalse', async () => {
    // Arrange
    const collection: UpsertCollectionMock = {
      updateOne: jest.fn(async () => ({ upsertedCount: 0 }))
    };
    const service = createService();
    // Action
    const result = await service.saveProperty(collection as never, createProperty('https://www.idealista.com/inmueble/123456789/', '123456789'));
    // Assert
    expect(collection.updateOne).toHaveBeenCalledTimes(3);
    expect(collection.updateOne).toHaveBeenNthCalledWith(
      2,
      { url: 'https://www.idealista.com/inmueble/123456789/' },
      expect.objectContaining({
        $set: expect.objectContaining({
          propertyId: '123456789',
          updatedBy: expect.any(Date)
        })
      }),
      { upsert: false }
    );
    expect(collection.updateOne).toHaveBeenNthCalledWith(
      3,
      {
        url: 'https://www.idealista.com/inmueble/123456789/',
        publicationDate: { $exists: false }
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          publicationDate: expect.any(Date)
        })
      }),
      { upsert: false }
    );
    expect(result).toEqual({ isNew: false });
  });

  it('whenPropertyExistsWithoutMappablePublicationAge_saveProperty_shouldAvoidPublicationDateFillUpdate', async () => {
    // Arrange
    const collection: UpsertCollectionMock = {
      updateOne: jest.fn(async () => ({ upsertedCount: 0 }))
    };
    const service = createService();
    const property = new Property(
      '123456789',
      'https://www.idealista.com/inmueble/123456789/',
      'Title',
      'Madrid',
      1000,
      new PropertyMainFeatures('80m2', '2', '2nd', []),
      'Comment',
      [new PropertyFeatureGroup('General', ['a'])],
      'texto no parseable',
      [new PropertyImage('https://img/1.jpg', null)]
    );
    // Action
    const result = await service.saveProperty(collection as never, property);
    // Assert
    expect(collection.updateOne).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ isNew: false });
  });

  it('whenDuplicateKeyErrorOccurs_saveProperty_shouldRetryWithUpsertDisabled', async () => {
    // Arrange
    const duplicateError = new Error('E11000 duplicate key');
    const collection: UpsertCollectionMock = {
      updateOne: jest.fn()
    };
    collection.updateOne
      .mockImplementationOnce(async () => {
        throw duplicateError;
      })
      .mockImplementationOnce(async () => ({ modifiedCount: 1 }));
    const service = createService();
    (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError = (error) => error === duplicateError;
    // Action
    const result = await service.saveProperty(collection as never, createProperty('https://www.idealista.com/inmueble/1/', '1'));
    // Assert
    expect(collection.updateOne).toHaveBeenNthCalledWith(
      1,
      { url: 'https://www.idealista.com/inmueble/1/' },
      expect.any(Object),
      { upsert: true }
    );
    expect(collection.updateOne).toHaveBeenNthCalledWith(
      2,
      { url: 'https://www.idealista.com/inmueble/1/' },
      expect.any(Object),
      { upsert: false }
    );
    expect(collection.updateOne).toHaveBeenNthCalledWith(
      3,
      {
        url: 'https://www.idealista.com/inmueble/1/',
        publicationDate: { $exists: false }
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          publicationDate: expect.any(Date)
        })
      }),
      { upsert: false }
    );
    expect(result).toEqual({ isNew: false });
  });

  it('whenDuplicateKeyErrorOccursAndPublicationAgeIsNotMappable_saveProperty_shouldSkipPublicationDateBackfill', async () => {
    // Arrange
    const duplicateError = new Error('E11000 duplicate key');
    const collection: UpsertCollectionMock = {
      updateOne: jest.fn()
    };
    collection.updateOne
      .mockImplementationOnce(async () => {
        throw duplicateError;
      })
      .mockImplementationOnce(async () => ({ modifiedCount: 1 }));
    const service = createService();
    (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError = (error) => error === duplicateError;
    const property = new Property(
      '1',
      'https://www.idealista.com/inmueble/1/',
      'Title',
      'Madrid',
      1000,
      new PropertyMainFeatures('80m2', '2', '2nd', []),
      'Comment',
      [new PropertyFeatureGroup('General', ['a'])],
      'texto no parseable',
      [new PropertyImage('https://img/1.jpg', null)]
    );
    // Action
    const result = await service.saveProperty(collection as never, property);
    // Assert
    expect(collection.updateOne).toHaveBeenCalledTimes(2);
    expect(collection.updateOne).toHaveBeenNthCalledWith(
      1,
      { url: 'https://www.idealista.com/inmueble/1/' },
      expect.any(Object),
      { upsert: true }
    );
    expect(collection.updateOne).toHaveBeenNthCalledWith(
      2,
      { url: 'https://www.idealista.com/inmueble/1/' },
      expect.any(Object),
      { upsert: false }
    );
    expect(result).toEqual({ isNew: false });
  });

  it('whenUnexpectedWriteErrorOccurs_saveProperty_shouldRethrowError', async () => {
    // Arrange
    const genericError = new Error('write failed');
    const collection: UpsertCollectionMock = {
      updateOne: jest.fn(async () => {
        throw genericError;
      })
    };
    const service = createService();
    (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError = () => false;
    // Action
    const action = service.saveProperty(collection as never, createProperty('https://www.idealista.com/inmueble/200/', '200'));
    // Assert
    await expect(action).rejects.toBe(genericError);
  });

  it('whenUrlHasNoPropertyId_saveProperty_shouldKeepPropertyIdAsNull', async () => {
    // Arrange
    const collection: UpsertCollectionMock = {
      updateOne: jest.fn(async () => ({ upsertedCount: 1 }))
    };
    const service = createService();
    // Action
    await service.saveProperty(collection as never, createProperty('https://www.idealista.com/alquiler-viviendas/madrid/', null));
    // Assert
    expect(collection.updateOne).toHaveBeenCalledWith(
      { url: 'https://www.idealista.com/alquiler-viviendas/madrid/' },
      expect.objectContaining({
        $set: expect.objectContaining({ propertyId: null }),
        $setOnInsert: expect.objectContaining({
          importedBy: expect.any(Date)
        })
      }),
      { upsert: true }
    );
  });

  it('whenErrorIsMongoDuplicateKey_isDuplicateKeyError_shouldReturnTrue', () => {
    // Arrange
    const service = createService();
    const duplicateError = new MongoServerError({ ok: 0, code: 11000, errmsg: 'duplicate key' });
    // Action
    const result = (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError(duplicateError);
    // Assert
    expect(result).toBe(true);
  });

  it('whenErrorIsMongoButNotDuplicate_isDuplicateKeyError_shouldReturnFalse', () => {
    // Arrange
    const service = createService();
    const nonDuplicateMongoError = new MongoServerError({ ok: 0, code: 50, errmsg: 'other mongo error' });
    // Action
    const result = (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError(nonDuplicateMongoError);
    // Assert
    expect(result).toBe(false);
  });

  it('whenErrorIsNotMongoServerError_isDuplicateKeyError_shouldReturnFalse', () => {
    // Arrange
    const service = createService();
    const genericError = new Error('generic error');
    // Action
    const result = (service as unknown as { isDuplicateKeyError: (error: unknown) => boolean }).isDuplicateKeyError(genericError);
    // Assert
    expect(result).toBe(false);
  });

  it.each([
    { input: '   ' },
    { input: 'https://www.idealista.com/alquiler-viviendas/madrid/' }
  ])('whenUrlHasNoPropertyId_extractPropertyIdFromUrl_shouldReturnNull', ({ input }) => {
    // Arrange
    const service = createService();
    // Action
    const result = (service as unknown as { extractPropertyIdFromUrl: (url: string) => string | null }).extractPropertyIdFromUrl(input);
    // Assert
    expect(result).toBeNull();
  });
});
