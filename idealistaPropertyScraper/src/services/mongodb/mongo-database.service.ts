import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MongoClient, Db, Collection, Document, WithId } from 'mongodb';
import { Configuration } from '../../config/configuration';
import { Property } from '../../model/property/property.model';
import { RabbitMqService } from '../rabbitmq/rabbit-mq.service';

@Injectable()
export class MongoDatabaseService implements OnModuleDestroy {
  private static readonly PROPERTIES_COLLECTION = 'properties';

  private readonly logger = new Logger(MongoDatabaseService.name);
  private mongoClient?: MongoClient;
  private database?: Db;
  private propertiesCollection?: Collection<Property & Document>;

  constructor(
    private readonly configuration: Configuration,
    private readonly rabbitMqService: RabbitMqService
  ) {}

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
    const importedBy = new Date();

    if (!existing) {
      await collection.insertOne({
        ...property,
        importedBy
      } as Property & Document);
      await this.rabbitMqService.publishIdealistaUpdateNotification(property.url, property.title);
      return;
    }

    const merged = {
      ...this.mergeProperty(existing, property),
      importedBy
    } as Property & Document;
    await collection.replaceOne({ _id: existing._id }, merged);
  }

  async saveClosedProperty(url: string, closedBy?: Date): Promise<void> {
    const collection = await this.ensurePropertiesCollection();
    const closeDate = closedBy ?? new Date();
    await collection.updateOne(
      { url },
      {
        $set: {
          closedBy: closeDate
        },
        $setOnInsert: {
          url,
          importedBy: new Date()
        }
      },
      { upsert: true }
    );
  }

  async propertyExistsByUrl(url: string): Promise<boolean> {
    const collection = await this.ensurePropertiesCollection();
    const existing = await collection.findOne(
      { url },
      { projection: { _id: 1 } }
    );
    return existing !== null;
  }

  async isOpenPropertyByUrl(url: string): Promise<boolean> {
    const collection = await this.ensurePropertiesCollection();
    const existing = await collection.findOne(
      {
        url,
        closedBy: { $exists: false }
      },
      { projection: { _id: 1 } }
    );
    return existing !== null;
  }

  async getOpenPropertyUrls(): Promise<string[]> {
    const collection = await this.ensurePropertiesCollection();
    const documents = await collection.find(
      {
        closedBy: { $exists: false },
        url: { $type: 'string' }
      },
      {
        projection: { _id: 0, url: 1 }
      }
    ).toArray();

    return documents
      .map((document) => (typeof document.url === 'string' ? document.url.trim() : ''))
      .filter((url) => url.length > 0);
  }

  async fixStringPricesToNumbers(): Promise<{
    scanned: number;
    updated: number;
    skipped: number;
    failed: number;
  }> {
    const collection = await this.ensurePropertiesCollection();
    const cursor = collection.find(
      {
        price: { $exists: true, $type: 'string' }
      },
      {
        projection: { _id: 1, price: 1 }
      }
    );

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for await (const document of cursor) {
      scanned += 1;
      const normalizedPrice = this.parseStringPriceToNumber(document.price);

      if (normalizedPrice === null) {
        skipped += 1;
        continue;
      }

      try {
        const result = await collection.updateOne(
          { _id: document._id },
          { $set: { price: normalizedPrice } }
        );
        if (result.modifiedCount > 0) {
          updated += 1;
        } else {
          skipped += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned,
      updated,
      skipped,
      failed
    };
  }

  async validateConnectionOrExit(): Promise<void> {
    const waitMs = this.configuration.chromeBrowserLaunchRetryWaitMs;
    const waitSeconds = Math.floor(waitMs / 1000);

    while (true) {
      try {
        await this.connect();
        const admin = this.mongoClient?.db('admin');
        if (!admin) {
          throw new Error('MongoDB admin database handle is not available.');
        }
        await admin.command({ ping: 1 });
        await this.ensurePropertiesCollectionAndUrlIndex();
        return;
      } catch {
        this.logger.error('MongoDB connection/authentication failed.');
        this.logger.error('Check propertyDetailScraper/secrets.json (mongodb credentials/authSource) and MongoDB network connectivity.');
        this.logger.error(
          `MongoDB validation failed. Keeping pod alive for ${waitSeconds} seconds before retrying so it can be debugged in Kubernetes.`
        );
        await this.sleep(waitMs);
      }
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseStringPriceToNumber(value: unknown): number | null {
    if (typeof value !== 'string') {
      return null;
    }

    const digitsOnly = value.replace(/\D+/g, '');
    if (digitsOnly.length === 0) {
      return null;
    }

    const parsed = Number.parseInt(digitsOnly, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
