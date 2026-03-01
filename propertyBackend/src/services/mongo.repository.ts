import { Injectable } from '@nestjs/common';
import { Document, WithId } from 'mongodb';
import { MongoDatabaseService } from './mongo-database.service';

export type PropertyLookupResult = {
  property: WithId<Document>;
  matchedBy: 'propertyId' | 'url';
  propertyIdWasMissing: boolean;
};

@Injectable()
export class MongoRepository {
  constructor(private readonly mongoDatabaseService: MongoDatabaseService) {}

  async findPropertyByPropertyIdOrUrl(propertyId: string): Promise<PropertyLookupResult | null> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const numericPropertyId = Number.parseInt(propertyId, 10);
    const idCandidates: Array<string | number> = [propertyId];
    if (Number.isFinite(numericPropertyId)) {
      idCandidates.push(numericPropertyId);
    }

    const byPropertyId = await collection.findOne({
      propertyId: { $in: idCandidates }
    });
    if (byPropertyId) {
      return {
        property: byPropertyId,
        matchedBy: 'propertyId',
        propertyIdWasMissing: false
      };
    }

    const escapedPropertyId = this.escapeRegex(propertyId);
    const byUrl = await collection.findOne({
      url: { $regex: new RegExp(`(^|/)${escapedPropertyId}(/|$)`) }
    });
    if (!byUrl) {
      return null;
    }

    const hasPropertyId = Object.prototype.hasOwnProperty.call(byUrl, 'propertyId');
    if (!hasPropertyId) {
      await collection.updateOne({ _id: byUrl._id }, { $set: { propertyId } });
      const refreshed = await collection.findOne({ _id: byUrl._id });
      if (refreshed) {
        return {
          property: refreshed,
          matchedBy: 'url',
          propertyIdWasMissing: true
        };
      }
    }

    return {
      property: byUrl,
      matchedBy: 'url',
      propertyIdWasMissing: !hasPropertyId
    };
  }

  async updatePropertyImages(propertyDocumentId: unknown, images: unknown[]): Promise<void> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    await collection.updateOne(
      { _id: propertyDocumentId as never },
      { $set: { images } }
    );
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
