import { Controller, Get } from '@nestjs/common';
import { DanglingImagesCleanupService } from '../services/datamaintenance/dangling-images-cleanup.service';

@Controller()
export class RemoveDanglingImagesController {
  constructor(private readonly danglingImagesCleanupService: DanglingImagesCleanupService) {}

  @Get('removeDanglingImages')
  async removeDanglingImages(): Promise<{
    status: string;
    scannedPropertyFolders: number;
    foldersWithoutMatchingProperty: number;
    propertyIdBackfilledInDatabase: number;
    scannedImageFiles: number;
    danglingImagesFound: number;
    removedDatabaseImageEntries: number;
  }> {
    const result = await this.danglingImagesCleanupService.removeDanglingImages();
    return {
      status: 'ok',
      ...result
    };
  }
}
