import { Injectable, Logger } from '@nestjs/common';
import { Dirent } from 'node:fs';
import { join } from 'node:path';
import { Configuration } from 'src/infrastructure/config/configuration';
import { MongoRepository, PropertyLookupResult } from 'src/adapters/outbound/persistence/mongodb/mongo.repository';
import { FileSystemOperationsService } from 'src/adapters/outbound/filesystem/file-system-operations.service';
import { PropertyImagesDatabaseCleanupService } from 'src/application/services/datamaintenance/property-images-database-cleanup.service';

type RemoveDanglingImagesResult = {
  incomingImagesRemoved: number;
  leftoverImagesRemoved: number;
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
    const incomingImagesRemoved = await this.removeImagesFromSpecialFolder(imagesRootPath, '_incoming');
    const leftoverImagesRemoved = await this.removeImagesFromSpecialFolder(imagesRootPath, '_leftovers');
    const entries = await this.fileSystemOperationsService.readDirectoryEntries(imagesRootPath);
    const numericPropertyFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^\d+$/.test(name));

    const result: RemoveDanglingImagesResult = {
      incomingImagesRemoved,
      leftoverImagesRemoved,
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

  private async removeImagesFromSpecialFolder(imagesRootPath: string, folderName: string): Promise<number> {
    const folderPath = join(imagesRootPath, folderName);
    const entries = await this.readDirectoryEntriesSafely(folderPath);
    if (!entries) {
      return 0;
    }

    let removedFiles = 0;

    for (const entry of entries) {
      const entryPath = join(folderPath, entry.name);
      if (entry.isFile()) {
        removedFiles += 1;
        await this.fileSystemOperationsService.removeFile(entryPath);
        continue;
      }

      if (entry.isDirectory()) {
        removedFiles += await this.countFilesRecursively(entryPath);
        await this.fileSystemOperationsService.removeDirectoryRecursively(entryPath);
        continue;
      }

      removedFiles += 1;
      await this.fileSystemOperationsService.removeFile(entryPath);
    }

    return removedFiles;
  }

  private async countFilesRecursively(path: string): Promise<number> {
    const entries = await this.readDirectoryEntriesSafely(path);
    if (!entries) {
      return 0;
    }

    let filesCount = 0;
    for (const entry of entries) {
      const entryPath = join(path, entry.name);
      if (entry.isFile()) {
        filesCount += 1;
        continue;
      }

      if (entry.isDirectory()) {
        filesCount += await this.countFilesRecursively(entryPath);
      }
    }

    return filesCount;
  }

  private async readDirectoryEntriesSafely(path: string): Promise<Dirent[] | null> {
    try {
      return await this.fileSystemOperationsService.readDirectoryEntries(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      throw error;
    }
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
