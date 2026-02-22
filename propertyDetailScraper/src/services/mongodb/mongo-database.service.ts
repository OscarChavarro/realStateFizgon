import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MongoClient, Db, Collection, Document, WithId } from 'mongodb';
import { Configuration } from '../../config/configuration';
import { Property } from '../../model/property/property.model';

@Injectable()
export class MongoDatabaseService implements OnModuleDestroy {
  private static readonly PROPERTIES_COLLECTION = 'properties';

  private readonly logger = new Logger(MongoDatabaseService.name);
  private mongoClient?: MongoClient;
  private database?: Db;
  private propertiesCollection?: Collection<Property & Document>;

  constructor(private readonly configuration: Configuration) {}

  async onModuleDestroy(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = undefined;
      this.database = undefined;
      this.propertiesCollection = undefined;
    }
  }

  async saveProperty(property: Property): Promise<void> {
    const collection = await this.ensurePropertiesCollection();
    const existing = await collection.findOne({ url: property.url });

    if (!existing) {
      await collection.insertOne(property as Property & Document);
      return;
    }

    const merged = this.mergeProperty(existing, property);
    await collection.replaceOne({ _id: existing._id }, merged);
  }

  async validateConnectionOrExit(): Promise<void> {
    try {
      await this.connect();
      const admin = this.mongoClient?.db('admin');
      if (!admin) {
        throw new Error('MongoDB admin database handle is not available.');
      }
      await admin.command({ ping: 1 });
      await this.ensurePropertiesCollectionAndUrlIndex();
    } catch {
      this.logger.error('MongoDB connection/authentication failed.');
      this.logger.error('Check propertyDetailScraper/secrets.json (mongodb credentials/authSource) and MongoDB network connectivity.');
      process.exit(1);
    }
  }

  private async ensurePropertiesCollection(): Promise<Collection<Property & Document>> {
    if (!this.propertiesCollection) {
      await this.connect();
    }

    if (!this.propertiesCollection) {
      throw new Error('MongoDB collection is not initialized.');
    }

    return this.propertiesCollection;
  }

  private async connect(): Promise<void> {
    if (this.mongoClient && this.database && this.propertiesCollection) {
      return;
    }

    this.mongoClient = new MongoClient(this.configuration.mongoConnectionUri);
    await this.mongoClient.connect();
    this.database = this.mongoClient.db(this.configuration.mongoDatabase);
    this.propertiesCollection = this.database.collection<Property & Document>(MongoDatabaseService.PROPERTIES_COLLECTION);
    this.logger.log(`Connected to MongoDB database "${this.configuration.mongoDatabase}".`);
  }

  private async ensurePropertiesCollectionAndUrlIndex(): Promise<void> {
    if (!this.database) {
      throw new Error('MongoDB database is not initialized.');
    }

    const collectionName = MongoDatabaseService.PROPERTIES_COLLECTION;
    const collectionExists = await this.database.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();

    if (!collectionExists) {
      await this.database.createCollection(collectionName);
      this.logger.log(`Created MongoDB collection "${collectionName}".`);
    }

    const collection = this.database.collection<Property & Document>(collectionName);
    await collection.createIndex({ url: 1 }, { name: 'url_1' });
    this.propertiesCollection = collection;
  }

  private mergeProperty(existing: WithId<Property & Document>, incoming: Property): Property & Document {
    const existingWithoutId = { ...existing } as Record<string, unknown>;
    delete existingWithoutId._id;
    return {
      ...(existingWithoutId as Property & Document),
      ...incoming
    };
  }
}
