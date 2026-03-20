import { describe, expect, it, jest } from '@jest/globals';
import { RunStartupPreChecksUseCase } from 'application/usecases/prechecks/run-startup-pre-checks.use-case';
import { ValidatePersistenceConnectionPreCheckUseCase } from 'application/usecases/prechecks/validate-persistence-connection-pre-check.use-case';
import { ValidateImageDownloadFolderPreCheckUseCase } from 'application/usecases/prechecks/validate-image-download-folder-pre-check.use-case';
import { ValidateProxyAccessPreCheckUseCase } from 'application/usecases/prechecks/validate-proxy-access-pre-check.use-case';

class ValidateProxyAccessPreCheckUseCaseMockForRunStartupPreChecksUseCase {
  readonly execute = jest.fn<() => Promise<void>>();
}

class ValidatePersistenceConnectionPreCheckUseCaseMockForRunStartupPreChecksUseCase {
  readonly execute = jest.fn<() => Promise<void>>();
}

class ValidateImageDownloadFolderPreCheckUseCaseMockForRunStartupPreChecksUseCase {
  readonly execute = jest.fn<() => Promise<void>>();
}

function createUseCase() {
  const validateProxyAccessPreCheckUseCase = new ValidateProxyAccessPreCheckUseCaseMockForRunStartupPreChecksUseCase();
  const validatePersistenceConnectionPreCheckUseCase =
    new ValidatePersistenceConnectionPreCheckUseCaseMockForRunStartupPreChecksUseCase();
  const validateImageDownloadFolderPreCheckUseCase =
    new ValidateImageDownloadFolderPreCheckUseCaseMockForRunStartupPreChecksUseCase();
  const useCase = new RunStartupPreChecksUseCase(
    validateProxyAccessPreCheckUseCase as unknown as ValidateProxyAccessPreCheckUseCase,
    validatePersistenceConnectionPreCheckUseCase as unknown as ValidatePersistenceConnectionPreCheckUseCase,
    validateImageDownloadFolderPreCheckUseCase as unknown as ValidateImageDownloadFolderPreCheckUseCase
  );

  return {
    useCase,
    validateProxyAccessPreCheckUseCase,
    validatePersistenceConnectionPreCheckUseCase,
    validateImageDownloadFolderPreCheckUseCase
  };
}

describe('RunStartupPreChecksUseCase', () => {
  it('whenAllPreChecksPass_execute_shouldValidateProxyMongoAndImageFolderInOrder', async () => {
    // Arrange
    const {
      useCase,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createUseCase();
    validateProxyAccessPreCheckUseCase.execute.mockResolvedValue(undefined);
    validatePersistenceConnectionPreCheckUseCase.execute.mockResolvedValue(undefined);
    validateImageDownloadFolderPreCheckUseCase.execute.mockResolvedValue(undefined);
    // Action
    await useCase.execute();
    // Assert
    expect(validateProxyAccessPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validatePersistenceConnectionPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validateImageDownloadFolderPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    const proxyCallOrder = validateProxyAccessPreCheckUseCase.execute.mock.invocationCallOrder[0];
    const mongoCallOrder = validatePersistenceConnectionPreCheckUseCase.execute.mock.invocationCallOrder[0];
    const imageCallOrder = validateImageDownloadFolderPreCheckUseCase.execute.mock.invocationCallOrder[0];
    expect(proxyCallOrder).toBeLessThan(mongoCallOrder);
    expect(mongoCallOrder).toBeLessThan(imageCallOrder);
  });

  it('whenProxyValidationFails_execute_shouldPropagateErrorAndSkipMongoAndImageChecks', async () => {
    // Arrange
    const {
      useCase,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createUseCase();
    validateProxyAccessPreCheckUseCase.execute.mockRejectedValue(new Error('proxy failed'));
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('proxy failed');
    expect(validatePersistenceConnectionPreCheckUseCase.execute).not.toHaveBeenCalled();
    expect(validateImageDownloadFolderPreCheckUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenMongoValidationFails_execute_shouldPropagateErrorAndSkipImageCheck', async () => {
    // Arrange
    const {
      useCase,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createUseCase();
    validateProxyAccessPreCheckUseCase.execute.mockResolvedValue(undefined);
    validatePersistenceConnectionPreCheckUseCase.execute.mockRejectedValue(new Error('mongo failed'));
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('mongo failed');
    expect(validateProxyAccessPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validateImageDownloadFolderPreCheckUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenImageFolderValidationFails_execute_shouldPropagateErrorAfterPreviousChecks', async () => {
    // Arrange
    const {
      useCase,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createUseCase();
    validateProxyAccessPreCheckUseCase.execute.mockResolvedValue(undefined);
    validatePersistenceConnectionPreCheckUseCase.execute.mockResolvedValue(undefined);
    validateImageDownloadFolderPreCheckUseCase.execute.mockRejectedValue(new Error('image folder failed'));
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('image folder failed');
    expect(validateProxyAccessPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validatePersistenceConnectionPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validateImageDownloadFolderPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
