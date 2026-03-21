import { Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { MongoPropertyDocument } from 'adapters/outbound/persistence/mongodb/mongo-property.document';

export type PriceFixSummary = {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
};

@Injectable()
export class MongoPriceMigrationService {
  async fixStringPricesToNumbers(collection: Collection<MongoPropertyDocument>): Promise<PriceFixSummary> {
    const cursor = collection.find(
      {
        price: { $exists: true, $type: 'string' }
      },
      {
        projection: { _id: 1, price: 1 }
      }
    );

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for await (const document of cursor) {
      scanned += 1;
      const normalizedPrice = this.parseStringPriceToNumber(document.price);

      if (normalizedPrice === null) {
        skipped += 1;
        continue;
      }

      try {
        const result = await collection.updateOne(
          { _id: document._id },
          { $set: { price: normalizedPrice } }
        );
        if (result.modifiedCount > 0) {
          updated += 1;
        } else {
          skipped += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned,
      updated,
      skipped,
      failed
    };
  }

  parseStringPriceToNumber(value: unknown): number | null {
    if (typeof value !== 'string') {
      return null;
    }

    const digitsOnly = value.replace(/\D+/g, '');
    if (digitsOnly.length === 0) {
      return null;
    }

    const parsed = Number.parseInt(digitsOnly, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
