import { describe, expect, it, jest } from '@jest/globals';
import { HomeSearchPreparationFlowService } from 'src/application/services/bootstrap/home-search-preparation-flow.service';
import { PrepareHomeSearchUseCase } from 'src/application/usecases/prepare-home-search.use-case';

class PrepareHomeSearchUseCaseMockForHomeSearchPreparationFlowService {
  readonly execute = jest.fn<(host: string, port: number) => Promise<void>>();
}

describe('HomeSearchPreparationFlowService', () => {
  it('whenBootstrapRequiresHomeSearchPreparation_execute_shouldDelegateToUseCase', async () => {
    // Arrange
    const prepareHomeSearchUseCase = new PrepareHomeSearchUseCaseMockForHomeSearchPreparationFlowService();
    prepareHomeSearchUseCase.execute.mockResolvedValue(undefined);
    const service = new HomeSearchPreparationFlowService(
      prepareHomeSearchUseCase as unknown as PrepareHomeSearchUseCase
    );
    // Action
    await service.execute('127.0.0.1', 9222);
    // Assert
    expect(prepareHomeSearchUseCase.execute).toHaveBeenCalledWith('127.0.0.1', 9222);
  });
});
