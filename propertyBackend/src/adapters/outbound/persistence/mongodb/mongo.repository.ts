import { Injectable } from '@nestjs/common';
import { Document, WithId } from 'mongodb';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';

export type PropertyLookupResult = {
  property: WithId<Document>;
  matchedBy: 'propertyId' | 'url';
  propertyIdWasMissing: boolean;
};

export type PropertySortField =
  | 'title'
  | 'location'
  | 'mainFeatures.area'
  | 'mainFeatures.bedrooms'
  | 'importedBy'
  | 'price'
  | 'propertyId';

export type PropertySortOrder = 'asc' | 'desc';

export type PropertySortCriterion = {
  sortBy: PropertySortField;
  order: PropertySortOrder;
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

  async findAllPropertiesPaginated(
    page: number,
    pageSize: number,
    sortCriteria: PropertySortCriterion[]
  ): Promise<unknown[]> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const skip = (page - 1) * pageSize;
    const mongoSort: Record<string, 1 | -1> = {};

    for (const criterion of sortCriteria) {
      mongoSort[criterion.sortBy] = criterion.order === 'asc' ? 1 : -1;
    }

    if (Object.keys(mongoSort).length === 0) {
      mongoSort._id = -1;
    }

    const documents = await collection
      .find({})
      .sort(mongoSort)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return documents;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
