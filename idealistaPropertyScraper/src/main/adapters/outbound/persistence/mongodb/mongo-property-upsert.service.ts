import { Injectable } from '@nestjs/common';
import { Collection, Document, MongoServerError } from 'mongodb';
import { Property } from 'src/domain/property/property.model';
import { SavePropertyResult } from 'src/ports/outbound/persistence/save-property-result.type';

@Injectable()
export class MongoPropertyUpsertService {
  async saveProperty(collection: Collection<Property & Document>, property: Property): Promise<SavePropertyResult> {
    const now = new Date();
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
            importedBy: now
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
