import { HttpClient } from '@angular/common/http';
import { MaintenanceOperationRunnerService } from 'src/app/maintenance/services/maintenance-operation-runner.service';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';

class MaintenanceOperationRunnerServiceMockFactory {
  static createHttpClientMock() {
    return {} as HttpClient;
  }

  static createOperationMock() {
    return {
      execute: jasmine.createSpy('execute')
    } as unknown as DatabaseMaintenanceOperation;
  }
}

describe('MaintenanceOperationRunnerService', () => {
  it('runOperation should return formatted success payload', async () => {
    // Arrange
    const service = new MaintenanceOperationRunnerService();
    const operation = MaintenanceOperationRunnerServiceMockFactory.createOperationMock();
    const http = MaintenanceOperationRunnerServiceMockFactory.createHttpClientMock();
    (operation.execute as jasmine.Spy).and.resolveTo({
      status: 200,
      body: { removed: 5 }
    });

    // Action
    const result = await service.runOperation(operation, http);

    // Assert
    expect(operation.execute).toHaveBeenCalledOnceWith(http);
    expect(result).toBe(`{
  "status": 200,
  "body": {
    "removed": 5
  }
}`);
  });

  [
    { thrown: new Error('network failed'), expectedError: 'network failed' },
    { thrown: 'plain-error', expectedError: 'plain-error' }
  ].forEach(({ thrown, expectedError }) => {
    it(`runOperation should return request-failed payload for thrown ${expectedError}`, async () => {
      // Arrange
      const service = new MaintenanceOperationRunnerService();
      const operation = MaintenanceOperationRunnerServiceMockFactory.createOperationMock();
      const http = MaintenanceOperationRunnerServiceMockFactory.createHttpClientMock();
      (operation.execute as jasmine.Spy).and.rejectWith(thrown);

      // Action
      const result = await service.runOperation(operation, http);

      // Assert
      expect(operation.execute).toHaveBeenCalledOnceWith(http);
      expect(result).toBe(`{
  "status": "request-failed",
  "error": "${expectedError}"
}`);
    });
  });
});
