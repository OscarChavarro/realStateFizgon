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
  | 'publicationDate'
  | 'importedBy'
  | 'price'
  | 'propertyId';

export type PropertySortOrder = 'asc' | 'desc';

export type PropertySortCriterion = {
  sortBy: PropertySortField;
  order: PropertySortOrder;
};

export type PublicationDateRangeFilter = {
  minPublicationDate?: Date;
  maxPublicationDate?: Date;
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
    showClosed: boolean,
    publicationDateRangeFilter?: PublicationDateRangeFilter
  ): Promise<unknown[]> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const skip = (page - 1) * pageSize;
    const query = this.buildPropertiesQuery(showClosed, publicationDateRangeFilter);
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
    showClosed: boolean,
    publicationDateRangeFilter?: PublicationDateRangeFilter
  ): Promise<unknown[]> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const query = this.buildPropertiesQuery(showClosed, publicationDateRangeFilter);
    const mongoSort = this.buildMongoSort(sortCriteria);

    const documents = await collection
      .find(query)
      .sort(mongoSort)
      .toArray();

    return documents;
  }

  async countProperties(
    showClosed: boolean,
    publicationDateRangeFilter?: PublicationDateRangeFilter
  ): Promise<number> {
    const collection = await this.mongoDatabaseService.getPropertiesCollection();
    const query = this.buildPropertiesQuery(showClosed, publicationDateRangeFilter);
    return collection.countDocuments(query);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildPropertiesQuery(
    showClosed: boolean,
    publicationDateRangeFilter?: PublicationDateRangeFilter
  ): Filter<Document> {
    const andConditions: Filter<Document>[] = [];

    if (!showClosed) {
      andConditions.push({
        $and: [
          { closedBy: { $exists: false } },
          { closedby: { $exists: false } },
          { closed_by: { $exists: false } }
        ]
      });
    }

    const publicationDateCondition: {
      $gte?: Date;
      $lte?: Date;
    } = {};
    if (publicationDateRangeFilter?.minPublicationDate) {
      publicationDateCondition.$gte = publicationDateRangeFilter.minPublicationDate;
    }
    if (publicationDateRangeFilter?.maxPublicationDate) {
      publicationDateCondition.$lte = publicationDateRangeFilter.maxPublicationDate;
    }
    if (Object.keys(publicationDateCondition).length > 0) {
      andConditions.push({
        publicationDate: publicationDateCondition
      });
    }

    if (andConditions.length === 0) {
      return {};
    }
    if (andConditions.length === 1) {
      return andConditions[0];
    }

    return {
      $and: andConditions
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
