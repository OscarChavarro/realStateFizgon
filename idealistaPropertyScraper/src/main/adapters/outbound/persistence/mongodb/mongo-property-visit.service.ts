import { Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { MongoPropertyDocument } from 'adapters/outbound/persistence/mongodb/mongo-property.document';

@Injectable()
export class MongoPropertyVisitService {
  async touchPropertyLastTimeVisited(
    collection: Collection<MongoPropertyDocument>,
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
    collection: Collection<MongoPropertyDocument>
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

  async getOpenPropertyUrls(collection: Collection<MongoPropertyDocument>): Promise<string[]> {
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
