import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Collection, Db, Document, MongoClient } from 'mongodb';
import { Configuration } from '../config/configuration';

@Injectable()
export class MongoDatabaseService implements OnModuleDestroy, OnModuleInit {
  private static readonly PROPERTIES_COLLECTION = 'properties';
  private static readonly MONGO_VALIDATION_RETRY_WAIT_MS = 3600 * 1000;
  private readonly logger = new Logger(MongoDatabaseService.name);

  private mongoClient?: MongoClient;
  private database?: Db;
  private propertiesCollection?: Collection<Document>;

  constructor(private readonly configuration: Configuration) {}

  async onModuleInit(): Promise<void> {
    await this.validateConnectionOrWait();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = undefined;
      this.database = undefined;
      this.propertiesCollection = undefined;
    }
  }

  async countProperties(): Promise<number> {
    const collection = await this.ensurePropertiesCollection();
    return collection.countDocuments({});
  }

  async validateConnectionOrWait(): Promise<void> {
    const waitSeconds = Math.floor(MongoDatabaseService.MONGO_VALIDATION_RETRY_WAIT_MS / 1000);

    while (true) {
      try {
        await this.connect();
        const admin = this.mongoClient?.db('admin');
        if (!admin) {
          throw new Error('MongoDB admin database handle is not available.');
        }
        await admin.command({ ping: 1 });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`MongoDB connection/authentication failed: ${message}`);
        this.logger.error('Check propertyBackend/secrets.json (mongodb credentials/authSource) and MongoDB network connectivity.');
        this.logger.error(
          `MongoDB validation failed. Keeping pod alive for ${waitSeconds} seconds before retrying so it can be debugged in Kubernetes.`
        );
        await this.resetConnection();
        await this.sleep(MongoDatabaseService.MONGO_VALIDATION_RETRY_WAIT_MS);
      }
    }
  }

  private async ensurePropertiesCollection(): Promise<Collection<Document>> {
    if (!this.propertiesCollection) {
      await this.connect();
    }

    if (!this.propertiesCollection) {
      throw new Error('MongoDB properties collection is not initialized.');
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
    this.propertiesCollection = this.database.collection<Document>(MongoDatabaseService.PROPERTIES_COLLECTION);

    this.logger.log(`Connected to MongoDB database "${this.configuration.mongoDatabase}".`);
  }

  private async resetConnection(): Promise<void> {
    if (this.mongoClient) {
      try {
        await this.mongoClient.close();
      } catch {
        // Ignore close errors on failed/partial connections.
      }
    }

    this.mongoClient = undefined;
    this.database = undefined;
    this.propertiesCollection = undefined;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
