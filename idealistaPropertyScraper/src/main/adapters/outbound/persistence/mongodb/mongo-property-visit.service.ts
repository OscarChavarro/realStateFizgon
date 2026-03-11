import { Injectable } from '@nestjs/common';
import { Collection, Document } from 'mongodb';
import { Property } from 'src/domain/property/property.model';

@Injectable()
export class MongoPropertyVisitService {
  async touchPropertyLastTimeVisited(
    collection: Collection<Property & Document>,
    url: string,
    visitedAt: Date = new Date()
  ): Promise<void> {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      return;
    }

    await collection.updateOne(
      { url: normalizedUrl },
      { $set: { lastTimeVisited: visitedAt } }
    );
  }

  async getOpenPropertyUrlsWithoutLastTimeVisited(
    collection: Collection<Property & Document>
  ): Promise<string[]> {
    const documents = await collection.find(
      {
        closedBy: { $exists: false },
        url: { $type: 'string' },
        $or: [
          { lastTimeVisited: { $exists: false } },
          { lastTimeVisited: null }
        ]
      },
      {
        projection: { _id: 0, url: 1 }
      }
    ).toArray();

    return this.extractValidUrls(documents);
  }

  async getOpenPropertyUrls(collection: Collection<Property & Document>): Promise<string[]> {
    const documents = await collection.find(
      {
        closedBy: { $exists: false },
        url: { $type: 'string' }
      },
      {
        projection: { _id: 0, url: 1 }
      }
    ).toArray();

    return this.extractValidUrls(documents);
  }

  private extractValidUrls(documents: Array<{ url?: unknown }>): string[] {
    return documents
      .map((document) => (typeof document.url === 'string' ? document.url.trim() : ''))
      .filter((url) => url.length > 0);
  }
}
