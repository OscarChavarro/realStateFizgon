import { describe, expect, it, jest } from '@jest/globals';
import { MarkPropertyClosedUseCase } from 'src/application/usecases/scraper/mark-property-closed.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

describe('MarkPropertyClosedUseCase', () => {
  it('whenDetailIsDeactivated_execute_shouldPersistClosedStatus', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.saveClosedProperty.mockResolvedValue(undefined);
    const useCase = new MarkPropertyClosedUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort
    );
    const closedBy = new Date('2026-01-15T00:00:00.000Z');
    // Action
    await useCase.execute('https://www.idealista.com/inmueble/123/', closedBy);
    // Assert
    expect(propertyPersistencePort.saveClosedProperty).toHaveBeenCalledWith(
      'https://www.idealista.com/inmueble/123/',
      closedBy
    );
  });

  it('whenClosedByIsNotProvided_execute_shouldPersistClosedStatusWithUndefinedDate', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.saveClosedProperty.mockResolvedValue(undefined);
    const useCase = new MarkPropertyClosedUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort
    );
    // Action
    await useCase.execute('https://www.idealista.com/inmueble/999/');
    // Assert
    expect(propertyPersistencePort.saveClosedProperty).toHaveBeenCalledWith(
      'https://www.idealista.com/inmueble/999/',
      undefined
    );
  });
});
