import { describe, expect, it, jest } from '@jest/globals';
import { MongoPriceMigrationService } from 'src/adapters/outbound/persistence/mongodb/mongo-price-migration.service';

type MigrationCollectionMock = {
  find: jest.Mock;
  updateOne: jest.Mock;
};

describe('MongoPriceMigrationService', () => {
  it.each([
    { input: null, expected: null },
    { input: 'abc', expected: null },
    { input: '1.200 EUR', expected: 1200 },
    { input: '9'.repeat(5000), expected: null }
  ])('whenParsingStringPrice_parseStringPriceToNumber_shouldReturnExpectedNumber', ({ input, expected }) => {
    // Arrange
    const service = new MongoPriceMigrationService();
    // Action
    const result = service.parseStringPriceToNumber(input);
    // Assert
    expect(result).toBe(expected);
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
    const collection: MigrationCollectionMock = {
      find: jest.fn(() => cursor as unknown as { toArray: () => Promise<Array<Record<string, unknown>>> }),
      updateOne
    };
    const service = new MongoPriceMigrationService();
    // Action
    const result = await service.fixStringPricesToNumbers(collection as never);
    // Assert
    expect(result).toEqual({
      scanned: 3,
      updated: 1,
      skipped: 1,
      failed: 1
    });
  });

  it('whenPriceUpdateDoesNotModifyDocument_fixStringPricesToNumbers_shouldCountItAsSkipped', async () => {
    // Arrange
    const cursor = {
      async *[Symbol.asyncIterator](): AsyncGenerator<{ _id: string; price: string }> {
        yield { _id: '1', price: '1.200 EUR' };
      }
    };
    const collection: MigrationCollectionMock = {
      find: jest.fn(() => cursor as unknown as { toArray: () => Promise<Array<Record<string, unknown>>> }),
      updateOne: jest.fn(async () => ({ modifiedCount: 0 }))
    };
    const service = new MongoPriceMigrationService();
    // Action
    const result = await service.fixStringPricesToNumbers(collection as never);
    // Assert
    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1, failed: 0 });
  });
});
