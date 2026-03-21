import { Injectable } from '@nestjs/common';
import { Collection, Document } from 'mongodb';
import { Property } from 'domain/property/property';
import { PropertyUrl } from 'domain/property/property-url';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { SavePropertyResult } from 'ports/outbound/persistence/save-property-result.type';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { MongoPriceMigrationService, PriceFixSummary } from 'adapters/outbound/persistence/mongodb/mongo-price-migration.service';
import { MongoPropertyUpsertService } from 'adapters/outbound/persistence/mongodb/mongo-property-upsert.service';
import { MongoPropertyVisitService } from 'adapters/outbound/persistence/mongodb/mongo-property-visit.service';
import { MongoDatabaseConnectionService } from 'adapters/outbound/persistence/mongodb/mongo-database-connection.service';

@Injectable()
export class MongoDatabaseService implements PropertyWritePort, PropertyReadPort {
  constructor(
    private readonly mongoDatabaseConnectionService: MongoDatabaseConnectionService,
    private readonly mongoPriceMigrationService: MongoPriceMigrationService,
    private readonly mongoPropertyUpsertService: MongoPropertyUpsertService,
    private readonly mongoPropertyVisitService: MongoPropertyVisitService
  ) {}

  async saveProperty(property: Property): Promise<SavePropertyResult> {
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
    return this.mongoPropertyUpsertService.saveProperty(collection, property);
  }

  async saveClosedProperty(url: string, closedBy?: Date): Promise<void> {
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
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
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
    const existing = await collection.findOne(
      { url },
      { projection: { _id: 1 } }
    );
    return existing !== null;
  }

  async isOpenPropertyByUrl(url: string): Promise<boolean> {
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
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
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
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
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
    await this.mongoPropertyVisitService.touchPropertyLastTimeVisited(collection, url, visitedAt);
  }

  async getOpenPropertyUrlsWithoutLastTimeVisited(): Promise<string[]> {
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
    return this.mongoPropertyVisitService.getOpenPropertyUrlsWithoutLastTimeVisited(collection);
  }

  async getOpenPropertyUrls(): Promise<string[]> {
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
    return this.mongoPropertyVisitService.getOpenPropertyUrls(collection);
  }

  async fixStringPricesToNumbers(): Promise<PriceFixSummary> {
    const collection = await this.mongoDatabaseConnectionService.getPropertiesCollection();
    return this.mongoPriceMigrationService.fixStringPricesToNumbers(collection);
  }

  private extractPropertyIdFromUrl(url: string): string | null {
    return PropertyUrl.extractPropertyId(url);
  }
}
