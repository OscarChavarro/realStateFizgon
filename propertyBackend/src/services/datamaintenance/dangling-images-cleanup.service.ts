import { Injectable, Logger } from '@nestjs/common';
import { Dirent } from 'node:fs';
import { join } from 'node:path';
import { Configuration } from '../../config/configuration';
import { MongoRepository, PropertyLookupResult } from '../mongo.repository';
import { FileSystemOperationsService } from './file-system-operations.service';
import { PropertyImagesDatabaseCleanupService } from './property-images-database-cleanup.service';

type RemoveDanglingImagesResult = {
  scannedPropertyFolders: number;
  foldersWithoutMatchingProperty: number;
  propertyIdBackfilledInDatabase: number;
  scannedImageFiles: number;
  danglingImagesFound: number;
  removedDatabaseImageEntries: number;
};

@Injectable()
export class DanglingImagesCleanupService {
  private readonly logger = new Logger(DanglingImagesCleanupService.name);

  constructor(
    private readonly configuration: Configuration,
    private readonly mongoRepository: MongoRepository,
    private readonly fileSystemOperationsService: FileSystemOperationsService,
    private readonly propertyImagesDatabaseCleanupService: PropertyImagesDatabaseCleanupService
  ) {}

  async removeDanglingImages(): Promise<RemoveDanglingImagesResult> {
    const imagesRootPath = this.configuration.imageDownloadFolder;
    const entries = await this.fileSystemOperationsService.readDirectoryEntries(imagesRootPath);
    const numericPropertyFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^\d+$/.test(name));

    const result: RemoveDanglingImagesResult = {
      scannedPropertyFolders: 0,
      foldersWithoutMatchingProperty: 0,
      propertyIdBackfilledInDatabase: 0,
      scannedImageFiles: 0,
      danglingImagesFound: 0,
      removedDatabaseImageEntries: 0
    };

    for (const propertyId of numericPropertyFolders) {
      result.scannedPropertyFolders += 1;
      const lookup = await this.mongoRepository.findPropertyByPropertyIdOrUrl(propertyId);
      if (!lookup) {
        result.foldersWithoutMatchingProperty += 1;
        const folderPath = join(imagesRootPath, propertyId);
        const imageFilesInFolder = await this.listFiles(folderPath);
        result.scannedImageFiles += imageFilesInFolder.length;
        result.danglingImagesFound += imageFilesInFolder.length;
        this.logger.warn(`Removing image folder ${propertyId}`);
        await this.fileSystemOperationsService.removeDirectoryRecursively(folderPath);
        continue;
      }

      if (lookup.propertyIdWasMissing) {
        result.propertyIdBackfilledInDatabase += 1;
      }

      const folderPath = join(imagesRootPath, propertyId);
      const imageFiles = await this.listFiles(folderPath);
      const existingImageFileNames = new Set(imageFiles.map((file) => file.name));

      const databaseCleanupResult = this.propertyImagesDatabaseCleanupService.removeDatabaseImageEntriesWithoutFile(
        lookup.property,
        existingImageFileNames
      );
      if (databaseCleanupResult.removedDatabaseImageEntries > 0) {
        await this.mongoRepository.updatePropertyImages(lookup.property._id, databaseCleanupResult.updatedImages);
        result.removedDatabaseImageEntries += databaseCleanupResult.removedDatabaseImageEntries;
      }

      const expectedImageFileNames = this.extractExpectedImageFileNames(lookup);

      for (const imageFile of imageFiles) {
        result.scannedImageFiles += 1;
        if (expectedImageFileNames.has(imageFile.name)) {
          continue;
        }

        result.danglingImagesFound += 1;
        this.logger.warn(`Removing single image ${propertyId}/${imageFile.name}`);
        const imagePath = join(folderPath, imageFile.name);
        await this.fileSystemOperationsService.removeFile(imagePath);
      }
    }

    return result;
  }

  private async listFiles(folderPath: string): Promise<Dirent[]> {
    const entries = await this.fileSystemOperationsService.readDirectoryEntries(folderPath);
    return entries.filter((entry) => entry.isFile());
  }

  private extractExpectedImageFileNames(lookup: PropertyLookupResult): Set<string> {
    const imageFileNames = new Set<string>();
    const imagesField = lookup.property.images;

    if (!Array.isArray(imagesField)) {
      return imageFileNames;
    }

    for (const imageItem of imagesField) {
      const fileName = this.propertyImagesDatabaseCleanupService.fileNameFromImageItem(imageItem);
      if (fileName) {
        imageFileNames.add(fileName);
      }
    }

    return imageFileNames;
  }
}
