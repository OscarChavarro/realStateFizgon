import { Injectable } from '@nestjs/common';
import { Collection, Document, MongoServerError } from 'mongodb';
import { MongoPublicationDateMapperService } from 'src/adapters/outbound/persistence/mongodb/mongo-publication-date-mapper.service';
import { Property } from 'src/domain/property/property.model';
import { SavePropertyResult } from 'src/ports/outbound/persistence/save-property-result.type';

@Injectable()
export class MongoPropertyUpsertService {
  constructor(
    private readonly mongoPublicationDateMapperService: MongoPublicationDateMapperService
  ) {}

  async saveProperty(collection: Collection<Property & Document>, property: Property): Promise<SavePropertyResult> {
    const now = new Date();
    const publicationDate = this.mongoPublicationDateMapperService.mapPublicationDate(property.publicationAge, now);
    const propertyId = property.propertyId ?? this.extractPropertyIdFromUrl(property.url);
    const normalizedProperty: Property = propertyId === property.propertyId
      ? property
      : {
          ...property,
          propertyId
        };

    try {
      const result = await collection.updateOne(
        { url: normalizedProperty.url },
        {
          $set: {
            ...normalizedProperty
          } as Property & Document,
          $setOnInsert: {
            importedBy: now,
            ...(publicationDate ? { publicationDate } : {})
          } as Document
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        return { isNew: true };
      }

      await collection.updateOne(
        { url: normalizedProperty.url },
        {
          $set: {
            ...normalizedProperty,
            updatedBy: now
          } as Property & Document
        },
        { upsert: false }
      );

      if (publicationDate) {
        await collection.updateOne(
          {
            url: normalizedProperty.url,
            publicationDate: { $exists: false }
          },
          {
            $set: { publicationDate }
          } as Document,
          { upsert: false }
        );
      }

      return { isNew: false };
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }

      await collection.updateOne(
        { url: normalizedProperty.url },
        {
          $set: {
            ...normalizedProperty,
            updatedBy: now
          } as Property & Document
        },
        { upsert: false }
      );

      if (publicationDate) {
        await collection.updateOne(
          {
            url: normalizedProperty.url,
            publicationDate: { $exists: false }
          },
          {
            $set: { publicationDate }
          } as Document,
          { upsert: false }
        );
      }

      return { isNew: false };
    }
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
