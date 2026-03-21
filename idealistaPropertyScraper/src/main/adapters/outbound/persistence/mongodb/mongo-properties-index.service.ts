import { Injectable, Logger } from '@nestjs/common';
import { Collection, MongoServerError } from 'mongodb';

import { MONGO_PROPERTIES_COLLECTION_NAME } from 'adapters/outbound/persistence/mongodb/mongo-properties.collection-name';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';
import { MongoPropertyDocument } from 'adapters/outbound/persistence/mongodb/mongo-property.document';

@Injectable()
export class MongoPropertiesIndexService {
  private readonly logger = new Logger(MongoPropertiesIndexService.name);

  constructor(private readonly mongoDatabaseConnectionService: MongoDatabaseConnectionService) {}

  async ensurePropertiesCollectionAndUrlIndex(): Promise<void> {
    const database = await this.mongoDatabaseConnectionService.getDatabase();
    const collectionExists = await database
      .listCollections({ name: MONGO_PROPERTIES_COLLECTION_NAME }, { nameOnly: true })
      .hasNext();

    if (!collectionExists) {
      await database.createCollection(MONGO_PROPERTIES_COLLECTION_NAME);
      this.logger.log(`Created MongoDB collection "${MONGO_PROPERTIES_COLLECTION_NAME}".`);
    }

    const collection = database.collection<MongoPropertyDocument>(MONGO_PROPERTIES_COLLECTION_NAME);
    await this.ensureUniqueUrlIndex(collection);
  }

  private async ensureUniqueUrlIndex(collection: Collection<MongoPropertyDocument>): Promise<void> {
    const indexes = await collection.indexes();
    const urlIndexes = indexes.filter((index) => this.isSingleUrlIndex(index.key));
    const uniqueUrlIndex = urlIndexes.find((index) => index.unique === true);
    if (uniqueUrlIndex) {
      return;
    }

    for (const index of urlIndexes) {
      if (typeof index.name === 'string' && index.name !== '_id_') {
        await collection.dropIndex(index.name);
        this.logger.warn(`Dropped non-unique URL index "${index.name}" to enforce unique URL writes.`);
      }
    }

    try {
      await collection.createIndex({ url: 1 }, { name: 'url_1', unique: true });
      this.logger.log('Ensured unique MongoDB index on properties.url.');
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new Error(
          'Cannot create unique index on properties.url because duplicate URLs already exist. Deduplicate collection first.'
        );
      }

      throw error;
    }
  }

  private isSingleUrlIndex(key: Record<string, unknown>): boolean {
    return Object.keys(key).length === 1 && key.url === 1;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return error instanceof MongoServerError && error.code === 11000;
  }
}
