import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MongoClient, Db, Collection, Document, MongoServerError } from 'mongodb';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { MongoConfig } from 'infrastructure/config/settings/mongo.config';
import { Property } from 'domain/property/property.model';
import { sleep } from 'infrastructure/sleep';
import { PersistenceHealthPort } from 'ports/outbound/persistence/persistence-health.port';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { SavePropertyResult } from 'ports/outbound/persistence/save-property-result.type';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { MongoPriceMigrationService, PriceFixSummary } from 'adapters/outbound/persistence/mongodb/mongo-price-migration.service';
import { MongoPropertyUpsertService } from 'adapters/outbound/persistence/mongodb/mongo-property-upsert.service';
import { MongoPropertyVisitService } from 'adapters/outbound/persistence/mongodb/mongo-property-visit.service';

@Injectable()
export class MongoDatabaseService implements OnModuleDestroy, PropertyWritePort, PropertyReadPort, PersistenceHealthPort {
  private static readonly PROPERTIES_COLLECTION = 'properties';

  private readonly logger = new Logger(MongoDatabaseService.name);
  private mongoClient?: MongoClient;
  private database?: Db;
  private propertiesCollection?: Collection<Property & Document>;

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly mongoConfig: MongoConfig,
    private readonly mongoPriceMigrationService: MongoPriceMigrationService,
    private readonly mongoPropertyUpsertService: MongoPropertyUpsertService,
    private readonly mongoPropertyVisitService: MongoPropertyVisitService
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = undefined;
      this.database = undefined;
      this.propertiesCollection = undefined;
    }
  }

  async saveProperty(property: Property): Promise<SavePropertyResult> {
    const collection = await this.ensurePropertiesCollection();
    return this.mongoPropertyUpsertService.saveProperty(collection, property);
  }

  async saveClosedProperty(url: string, closedBy?: Date): Promise<void> {
    const collection = await this.ensurePropertiesCollection();
    const closeDate = closedBy ?? new Date();
    const propertyId = this.extractPropertyIdFromUrl(url);
    await collection.updateOne(
      { url },
      {
        $set: {
          closedBy: closeDate
        },
        $setOnInsert: {
          url,
          propertyId,
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

  async hasGeoLocationHintByUrl(url: string): Promise<boolean> {
    const collection = await this.ensurePropertiesCollection();
    const existing = await collection.findOne(
      {
        url,
        'geoLocationHint.lat': { $type: 'number' },
        'geoLocationHint.lon': { $type: 'number' }
      },
      { projection: { _id: 1 } }
    );
    return existing !== null;
  }

  async touchPropertyLastTimeVisited(url: string, visitedAt: Date = new Date()): Promise<void> {
    const collection = await this.ensurePropertiesCollection();
    await this.mongoPropertyVisitService.touchPropertyLastTimeVisited(collection, url, visitedAt);
  }

  async getOpenPropertyUrlsWithoutLastTimeVisited(): Promise<string[]> {
    const collection = await this.ensurePropertiesCollection();
    return this.mongoPropertyVisitService.getOpenPropertyUrlsWithoutLastTimeVisited(collection);
  }

  async getOpenPropertyUrls(): Promise<string[]> {
    const collection = await this.ensurePropertiesCollection();
    return this.mongoPropertyVisitService.getOpenPropertyUrls(collection);
  }

  async fixStringPricesToNumbers(): Promise<PriceFixSummary> {
    const collection = await this.ensurePropertiesCollection();
    return this.mongoPriceMigrationService.fixStringPricesToNumbers(collection);
  }

  async validateConnectionOrExit(): Promise<void> {
    const waitMs = this.chromeConfig.chromeBrowserLaunchRetryWaitMs;
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
        await sleep(waitMs);
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

    this.mongoClient = new MongoClient(this.mongoConfig.mongoConnectionUri);
    await this.mongoClient.connect();
    this.database = this.mongoClient.db(this.mongoConfig.mongoDatabase);
    this.propertiesCollection = this.database.collection<Property & Document>(MongoDatabaseService.PROPERTIES_COLLECTION);
    this.logger.log(`Connected to MongoDB database "${this.mongoConfig.mongoDatabase}".`);
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
    await this.ensureUniqueUrlIndex(collection);
    this.propertiesCollection = collection;
  }

  private async ensureUniqueUrlIndex(collection: Collection<Property & Document>): Promise<void> {
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

  private extractPropertyIdFromUrl(url: string): string | null {
    const normalized = url.trim();
    if (!normalized) {
      return null;
    }

    const match = normalized.match(/\/inmueble\/(\d+)(?:\/|$)/i);
    if (!match) {
      return null;
    }

    return match[1];
  }
}
