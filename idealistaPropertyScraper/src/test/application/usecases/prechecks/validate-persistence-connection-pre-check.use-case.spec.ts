import { describe, expect, it, jest } from '@jest/globals';
import { ValidatePersistenceConnectionPreCheckUseCase } from 'application/usecases/prechecks/validate-persistence-connection-pre-check.use-case';
import { PropertyPersistencePort } from 'ports/outbound/persistence/property-persistence.port';
import { PropertyPersistencePortMock } from '../../../ports/outbound/persistence/property-persistence-port.mock';

describe('ValidatePersistenceConnectionPreCheckUseCase', () => {
  it('whenPersistenceIsReachable_execute_shouldValidateConnectionThroughPort', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.validateConnectionOrExit.mockResolvedValue(undefined);
    const useCase = new ValidatePersistenceConnectionPreCheckUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort
    );
    // Action
    await useCase.execute();
    // Assert
    expect(propertyPersistencePort.validateConnectionOrExit).toHaveBeenCalledTimes(1);
  });

  it('whenPersistenceValidationFails_execute_shouldPropagateError', async () => {
    // Arrange
    const propertyPersistencePort = new PropertyPersistencePortMock();
    propertyPersistencePort.validateConnectionOrExit.mockRejectedValue(new Error('mongo unavailable'));
    const useCase = new ValidatePersistenceConnectionPreCheckUseCase(
      propertyPersistencePort as unknown as PropertyPersistencePort
    );
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('mongo unavailable');
  });
});
