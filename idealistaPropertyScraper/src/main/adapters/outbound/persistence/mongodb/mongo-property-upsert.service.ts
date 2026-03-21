import { Injectable } from '@nestjs/common';
import { Collection, Document, MongoServerError } from 'mongodb';
import { MongoPublicationDateMapperService } from 'adapters/outbound/persistence/mongodb/mongo-publication-date-mapper.service';
import { MongoPropertyDocument } from 'adapters/outbound/persistence/mongodb/mongo-property.document';
import { Property } from 'domain/property/property';
import { PropertyUrl } from 'domain/property/property-url';
import { SavePropertyResult } from 'ports/outbound/persistence/save-property-result.type';

@Injectable()
export class MongoPropertyUpsertService {
  constructor(
    private readonly mongoPublicationDateMapperService: MongoPublicationDateMapperService
  ) {}

  async saveProperty(collection: Collection<MongoPropertyDocument>, property: Property): Promise<SavePropertyResult> {
    const now = new Date();
    const publicationDate = this.mongoPublicationDateMapperService.mapPublicationDate(property.publicationAge, now);
    const propertyId = property.propertyId ?? this.extractPropertyIdFromUrl(property.url.value);
    const normalizedProperty: Property = propertyId === property.propertyId
      ? property
      : property.withPropertyId(propertyId);
    const upsertSetDocument = this.toSetDocument(normalizedProperty);
    const normalizedUrl = normalizedProperty.url.value;

    try {
      const result = await collection.updateOne(
        { url: normalizedUrl },
        {
          $set: upsertSetDocument,
          $unset: {
            closedBy: ''
          },
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
        { url: normalizedUrl },
        {
          $set: this.toSetDocument(normalizedProperty, now),
          $unset: {
            closedBy: ''
          }
        },
        { upsert: false }
      );

      if (publicationDate) {
        await collection.updateOne(
          {
            url: normalizedUrl,
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
        { url: normalizedUrl },
        {
          $set: this.toSetDocument(normalizedProperty, now),
          $unset: {
            closedBy: ''
          }
        },
        { upsert: false }
      );

      if (publicationDate) {
        await collection.updateOne(
          {
            url: normalizedUrl,
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
    return PropertyUrl.extractPropertyId(url);
  }

  private toSetDocument(property: Property, updatedBy?: Date): MongoPropertyDocument {
    const document: Record<string, unknown> = {
      ...property.toPrimitives()
    };
    if (updatedBy) {
      document['updatedBy'] = updatedBy;
    }

    for (const [key, value] of Object.entries(document)) {
      if (value === undefined) {
        delete document[key];
      }
    }

    return document as MongoPropertyDocument;
  }
}
