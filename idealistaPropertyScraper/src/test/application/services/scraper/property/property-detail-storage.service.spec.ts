import { describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailStorageService } from 'src/application/services/scraper/property/property-detail-storage.service';
import { PersistPropertyDetailAndAssetsUseCase } from 'src/application/usecases/persist-property-detail-and-assets.use-case';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../../ports/outbound/persistence/property-persistence-port.mock';

class PersistPropertyDetailAndAssetsUseCaseMockForDetailStorage {
  readonly execute = jest.fn<(property: Property) => Promise<void>>();
}

function createProperty(): Property {
  return new Property(
    '123',
    'https://www.idealista.com/inmueble/123/',
    'Title',
    'Madrid',
    1000,
    new PropertyMainFeatures('80 m2', '2', 'Exterior', []),
    'Comment',
    [new PropertyFeatureGroup('General', ['Ascensor'])],
    'hace 3 días',
    [new PropertyImage('https://img/a.jpg', 'img')]
  );
}

describe('PropertyDetailStorageService', () => {
  it('whenDetailIsDeactivated_markPropertyClosed_shouldPersistClosedStatus', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    mongo.saveClosedProperty.mockResolvedValue(undefined);
    const persistPropertyDetailAndAssetsUseCase = new PersistPropertyDetailAndAssetsUseCaseMockForDetailStorage();
    const service = new PropertyDetailStorageService(
      mongo as unknown as PropertyPersistencePort,
      persistPropertyDetailAndAssetsUseCase as unknown as PersistPropertyDetailAndAssetsUseCase
    );
    const closedBy = new Date('2026-01-15T00:00:00.000Z');
    // Action
    await service.markPropertyClosed('https://www.idealista.com/inmueble/123/', closedBy);
    // Assert
    expect(mongo.saveClosedProperty).toHaveBeenCalledWith('https://www.idealista.com/inmueble/123/', closedBy);
    expect(persistPropertyDetailAndAssetsUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenPropertyMustBePersistedWithAssets_savePropertyWithImages_shouldDelegateToUseCase', async () => {
    // Arrange
    const mongo = new PropertyPersistencePortMock();
    const persistPropertyDetailAndAssetsUseCase = new PersistPropertyDetailAndAssetsUseCaseMockForDetailStorage();
    persistPropertyDetailAndAssetsUseCase.execute.mockResolvedValue(undefined);
    const service = new PropertyDetailStorageService(
      mongo as unknown as PropertyPersistencePort,
      persistPropertyDetailAndAssetsUseCase as unknown as PersistPropertyDetailAndAssetsUseCase
    );
    const property = createProperty();
    // Action
    await service.savePropertyWithImages(property);
    // Assert
    expect(persistPropertyDetailAndAssetsUseCase.execute).toHaveBeenCalledWith(property);
  });
});
