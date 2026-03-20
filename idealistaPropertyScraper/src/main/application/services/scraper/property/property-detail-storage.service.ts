import { Injectable } from '@nestjs/common';
import { Property } from 'src/domain/property/property.model';
import { MarkPropertyClosedUseCase } from 'src/application/usecases/scraper/mark-property-closed.use-case';
import { PersistPropertyDetailAndAssetsUseCase } from 'src/application/usecases/scraper/persist-property-detail-and-assets.use-case';

@Injectable()
export class PropertyDetailStorageService {
  constructor(
    private readonly markPropertyClosedUseCase: MarkPropertyClosedUseCase,
    private readonly persistPropertyDetailAndAssetsUseCase: PersistPropertyDetailAndAssetsUseCase
  ) {}

  async markPropertyClosed(url: string, closedBy?: Date): Promise<void> {
    await this.markPropertyClosedUseCase.execute(url, closedBy);
  }

  async savePropertyWithImages(property: Property): Promise<void> {
    await this.persistPropertyDetailAndAssetsUseCase.execute(property);
  }
}
