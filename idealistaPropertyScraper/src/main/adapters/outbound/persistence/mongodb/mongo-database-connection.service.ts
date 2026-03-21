import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Collection, Db, Document, MongoClient } from 'mongodb';
import { Property } from 'domain/property/property';
import { MONGO_SETTINGS_PORT } from 'ports/outbound/settings/mongo-settings.port.token';

import { MONGO_PROPERTIES_COLLECTION_NAME } from 'adapters/outbound/persistence/mongodb/mongo-properties.collection-name';
import type { MongoSettingsPort } from 'ports/outbound/settings/mongo-settings.port';

@Injectable()
export class MongoDatabaseConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(MongoDatabaseConnectionService.name);

  private mongoClient?: MongoClient;
  private database?: Db;
  private propertiesCollection?: Collection<Property & Document>;

  constructor(
    @Inject(MONGO_SETTINGS_PORT)
    private readonly mongoSettingsPort: MongoSettingsPort
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (!this.mongoClient) {
      return;
    }

    await this.mongoClient.close();
    this.mongoClient = undefined;
    this.database = undefined;
    this.propertiesCollection = undefined;
  }

  async getDatabase(): Promise<Db> {
    if (!this.database) {
      await this.connect();
    }

    if (!this.database) {
      throw new Error('MongoDB database is not initialized.');
    }

    return this.database;
  }

  async getPropertiesCollection(): Promise<Collection<Property & Document>> {
    if (!this.propertiesCollection) {
      await this.connect();
    }

    if (!this.propertiesCollection) {
      throw new Error('MongoDB collection is not initialized.');
    }

    return this.propertiesCollection;
  }

  async pingAdmin(): Promise<void> {
    await this.connect();
    const admin = this.mongoClient?.db('admin');
    if (!admin) {
      throw new Error('MongoDB admin database handle is not available.');
    }

    await admin.command({ ping: 1 });
  }

  private async connect(): Promise<void> {
    if (this.mongoClient && this.database && this.propertiesCollection) {
      return;
    }

    this.mongoClient = new MongoClient(this.mongoSettingsPort.mongoConnectionUri);
    await this.mongoClient.connect();
    this.database = this.mongoClient.db(this.mongoSettingsPort.mongoDatabase);
    this.propertiesCollection = this.database.collection<Property & Document>(MONGO_PROPERTIES_COLLECTION_NAME);
    this.logger.log(`Connected to MongoDB database "${this.mongoSettingsPort.mongoDatabase}".`);
  }
}
