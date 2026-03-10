import { Injectable } from '@nestjs/common';
import { Document, Filter, WithId } from 'mongodb';
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
    sortCriteria: PropertySortCriterion[],
    showClosed: boolean
  ): Promise<unknown[]> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const skip = (page - 1) * pageSize;
    const query = this.buildPropertiesQuery(showClosed);
    const mongoSort = this.buildMongoSort(sortCriteria);

    const documents = await collection
      .find(query)
      .sort(mongoSort)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return documents;
  }

  async findAllPropertiesSorted(
    sortCriteria: PropertySortCriterion[],
    showClosed: boolean
  ): Promise<unknown[]> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const query = this.buildPropertiesQuery(showClosed);
    const mongoSort = this.buildMongoSort(sortCriteria);

    const documents = await collection
      .find(query)
      .sort(mongoSort)
      .toArray();

    return documents;
  }

  async countProperties(showClosed: boolean): Promise<number> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const query = this.buildPropertiesQuery(showClosed);
    return collection.countDocuments(query);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildPropertiesQuery(showClosed: boolean): Filter<Document> {
    if (showClosed) {
      return {};
    }

    return {
      $and: [
        { closedBy: { $exists: false } },
        { closedby: { $exists: false } },
        { closed_by: { $exists: false } }
      ]
    };
  }

  private buildMongoSort(sortCriteria: PropertySortCriterion[]): Record<string, 1 | -1> {
    const mongoSort: Record<string, 1 | -1> = {};

    for (const criterion of sortCriteria) {
      mongoSort[criterion.sortBy] = criterion.order === 'asc' ? 1 : -1;
    }

    if (Object.keys(mongoSort).length === 0) {
      mongoSort._id = -1;
    }

    return mongoSort;
  }
}
