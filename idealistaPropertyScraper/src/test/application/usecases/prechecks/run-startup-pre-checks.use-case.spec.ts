import { describe, expect, it, jest } from '@jest/globals';
import { InfrastructurePreCheckService } from 'application/services/prechecks/infrastructure-pre-check.service';
import { RunStartupPreChecksUseCase } from 'application/usecases/prechecks/run-startup-pre-checks.use-case';

class InfrastructurePreCheckServiceMockForRunStartupPreChecksUseCase {
  readonly runBeforeScraperStartup = jest.fn<() => Promise<void>>();
}

describe('RunStartupPreChecksUseCase', () => {
  it('whenExecutingStartupPreChecks_execute_shouldDelegateToInfrastructurePreCheckService', async () => {
    // Arrange
    const infrastructurePreCheckService = new InfrastructurePreCheckServiceMockForRunStartupPreChecksUseCase();
    infrastructurePreCheckService.runBeforeScraperStartup.mockResolvedValue(undefined);
    const useCase = new RunStartupPreChecksUseCase(
      infrastructurePreCheckService as unknown as InfrastructurePreCheckService
    );
    // Action
    await useCase.execute();
    // Assert
    expect(infrastructurePreCheckService.runBeforeScraperStartup).toHaveBeenCalledTimes(1);
  });

  it('whenInfrastructurePreCheckFails_execute_shouldPropagateError', async () => {
    // Arrange
    const infrastructurePreCheckService = new InfrastructurePreCheckServiceMockForRunStartupPreChecksUseCase();
    infrastructurePreCheckService.runBeforeScraperStartup.mockRejectedValue(new Error('precheck failed'));
    const useCase = new RunStartupPreChecksUseCase(
      infrastructurePreCheckService as unknown as InfrastructurePreCheckService
    );
    // Action
    const action = useCase.execute();
    // Assert
    await expect(action).rejects.toThrow('precheck failed');
  });
});
