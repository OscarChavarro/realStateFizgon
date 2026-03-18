import { Inject, Injectable, Logger } from '@nestjs/common';
import { Property } from 'src/domain/property/property.model';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';
import { PersistPropertyDetailAndAssetsUseCase } from 'src/application/usecases/persist-property-detail-and-assets.use-case';

@Injectable()
export class PropertyDetailStorageService {
  private readonly logger = new Logger(PropertyDetailStorageService.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly persistPropertyDetailAndAssetsUseCase: PersistPropertyDetailAndAssetsUseCase
  ) {}

  async markPropertyClosed(url: string, closedBy?: Date): Promise<void> {
    this.logger.warn(`Property URL is no longer available (deactivated-detail): ${url}`);
    await this.propertyPersistencePort.saveClosedProperty(url, closedBy);
  }

  async savePropertyWithImages(property: Property): Promise<void> {
    await this.persistPropertyDetailAndAssetsUseCase.execute(property);
  }
}
