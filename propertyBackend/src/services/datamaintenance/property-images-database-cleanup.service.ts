import { Injectable } from '@nestjs/common';
import { Document, WithId } from 'mongodb';

export type PropertyImagesDatabaseCleanupResult = {
  updatedImages: unknown[];
  removedDatabaseImageEntries: number;
};

@Injectable()
export class PropertyImagesDatabaseCleanupService {
  removeDatabaseImageEntriesWithoutFile(
    property: WithId<Document>,
    existingImageFileNames: Set<string>
  ): PropertyImagesDatabaseCleanupResult {
    const imagesField = property.images;
    if (!Array.isArray(imagesField)) {
      return {
        updatedImages: [],
        removedDatabaseImageEntries: 0
      };
    }

    const updatedImages: unknown[] = [];
    let removedDatabaseImageEntries = 0;

    for (const imageItem of imagesField) {
      const fileName = this.fileNameFromImageItem(imageItem);
      if (!fileName) {
        updatedImages.push(imageItem);
        continue;
      }

      if (!existingImageFileNames.has(fileName)) {
        removedDatabaseImageEntries += 1;
        continue;
      }

      updatedImages.push(imageItem);
    }

    return {
      updatedImages,
      removedDatabaseImageEntries
    };
  }

  fileNameFromImageItem(imageItem: unknown): string | null {
    if (typeof imageItem === 'string') {
      return this.fileNameFromImageUrl(imageItem);
    }

    if (typeof imageItem === 'object' && imageItem !== null) {
      const maybeUrl = (imageItem as { url?: unknown }).url;
      if (typeof maybeUrl === 'string') {
        return this.fileNameFromImageUrl(maybeUrl);
      }
    }

    return null;
  }

  private fileNameFromImageUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const segments = parsedUrl.pathname.split('/').filter((segment) => segment.length > 0);
      const lastFourSegments = segments.slice(-4);
      if (lastFourSegments.length < 4) {
        return null;
      }
      return lastFourSegments.join('_');
    } catch {
      return null;
    }
  }
}

