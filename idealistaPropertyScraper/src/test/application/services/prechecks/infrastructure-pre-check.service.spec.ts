import { describe, expect, it, jest } from '@jest/globals';
import { InfrastructurePreCheckService } from 'application/services/prechecks/infrastructure-pre-check.service';
import { ValidatePersistenceConnectionPreCheckUseCase } from 'application/usecases/prechecks/validate-persistence-connection-pre-check.use-case';
import { ValidateImageDownloadFolderPreCheckUseCase } from 'application/usecases/prechecks/validate-image-download-folder-pre-check.use-case';
import { ValidateProxyAccessPreCheckUseCase } from 'application/usecases/prechecks/validate-proxy-access-pre-check.use-case';

class ValidateProxyAccessPreCheckUseCaseMockForInfrastructurePreCheckService {
  readonly execute = jest.fn<() => Promise<void>>();
}

class ValidatePersistenceConnectionPreCheckUseCaseMockForInfrastructurePreCheckService {
  readonly execute = jest.fn<() => Promise<void>>();
}

class ValidateImageDownloadFolderPreCheckUseCaseMockForInfrastructurePreCheckService {
  readonly execute = jest.fn<() => Promise<void>>();
}

function createService() {
  const validateProxyAccessPreCheckUseCase =
    new ValidateProxyAccessPreCheckUseCaseMockForInfrastructurePreCheckService();
  const validatePersistenceConnectionPreCheckUseCase =
    new ValidatePersistenceConnectionPreCheckUseCaseMockForInfrastructurePreCheckService();
  const validateImageDownloadFolderPreCheckUseCase =
    new ValidateImageDownloadFolderPreCheckUseCaseMockForInfrastructurePreCheckService();
  const service = new InfrastructurePreCheckService(
    validateProxyAccessPreCheckUseCase as unknown as ValidateProxyAccessPreCheckUseCase,
    validatePersistenceConnectionPreCheckUseCase as unknown as ValidatePersistenceConnectionPreCheckUseCase,
    validateImageDownloadFolderPreCheckUseCase as unknown as ValidateImageDownloadFolderPreCheckUseCase
  );

  return {
    service,
    validateProxyAccessPreCheckUseCase,
    validatePersistenceConnectionPreCheckUseCase,
    validateImageDownloadFolderPreCheckUseCase
  };
}

describe('InfrastructurePreCheckService', () => {
  it('whenAllPreChecksPass_runBeforeScraperStartup_shouldValidateProxyMongoAndImageFolderInOrder', async () => {
    // Arrange
    const {
      service,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createService();
    validateProxyAccessPreCheckUseCase.execute.mockResolvedValue(undefined);
    validatePersistenceConnectionPreCheckUseCase.execute.mockResolvedValue(undefined);
    validateImageDownloadFolderPreCheckUseCase.execute.mockResolvedValue(undefined);
    // Action
    await service.runBeforeScraperStartup();
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

  it('whenProxyValidationFails_runBeforeScraperStartup_shouldPropagateErrorAndSkipMongoAndImageChecks', async () => {
    // Arrange
    const {
      service,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createService();
    validateProxyAccessPreCheckUseCase.execute.mockRejectedValue(new Error('proxy failed'));
    // Action
    const action = service.runBeforeScraperStartup();
    // Assert
    await expect(action).rejects.toThrow('proxy failed');
    expect(validatePersistenceConnectionPreCheckUseCase.execute).not.toHaveBeenCalled();
    expect(validateImageDownloadFolderPreCheckUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenMongoValidationFails_runBeforeScraperStartup_shouldPropagateErrorAndSkipImageCheck', async () => {
    // Arrange
    const {
      service,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createService();
    validateProxyAccessPreCheckUseCase.execute.mockResolvedValue(undefined);
    validatePersistenceConnectionPreCheckUseCase.execute.mockRejectedValue(new Error('mongo failed'));
    // Action
    const action = service.runBeforeScraperStartup();
    // Assert
    await expect(action).rejects.toThrow('mongo failed');
    expect(validateProxyAccessPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validateImageDownloadFolderPreCheckUseCase.execute).not.toHaveBeenCalled();
  });

  it('whenImageFolderValidationFails_runBeforeScraperStartup_shouldPropagateErrorAfterPreviousChecks', async () => {
    // Arrange
    const {
      service,
      validateProxyAccessPreCheckUseCase,
      validatePersistenceConnectionPreCheckUseCase,
      validateImageDownloadFolderPreCheckUseCase
    } = createService();
    validateProxyAccessPreCheckUseCase.execute.mockResolvedValue(undefined);
    validatePersistenceConnectionPreCheckUseCase.execute.mockResolvedValue(undefined);
    validateImageDownloadFolderPreCheckUseCase.execute.mockRejectedValue(new Error('image folder failed'));
    // Action
    const action = service.runBeforeScraperStartup();
    // Assert
    await expect(action).rejects.toThrow('image folder failed');
    expect(validateProxyAccessPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validatePersistenceConnectionPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
    expect(validateImageDownloadFolderPreCheckUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
