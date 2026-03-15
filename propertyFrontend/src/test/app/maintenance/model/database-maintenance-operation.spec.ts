import { HttpClient, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { DatabaseMaintenanceOperation } from 'src/app/maintenance/model/database-maintenance-operation';

class TestMaintenanceOperation extends DatabaseMaintenanceOperation {
  constructor(endpointPath: string) {
    super('REMOVE_DANGLING_IMAGES', endpointPath);
  }
}

class DatabaseMaintenanceOperationMockFactory {
  static createHttpClientMock() {
    return {
      get: jasmine.createSpy('get')
    } as unknown as HttpClient;
  }
}

describe('DatabaseMaintenanceOperation', () => {
  [
    { endpointPath: 'removeDanglingImages', expectedEndpoint: '/removeDanglingImages' },
    { endpointPath: '/removeDanglingImages', expectedEndpoint: '/removeDanglingImages' }
  ].forEach(({ endpointPath, expectedEndpoint }) => {
    it(`execute should call "${expectedEndpoint}" for endpointPath "${endpointPath}"`, async () => {
      // Arrange
      const operation = new TestMaintenanceOperation(endpointPath);
      const http = DatabaseMaintenanceOperationMockFactory.createHttpClientMock();
      (http.get as jasmine.Spy).and.returnValue(
        of(new HttpResponse<unknown>({ status: 201, body: { ok: true } }))
      );

      // Action
      const result = await operation.execute(http);

      // Assert
      expect(http.get).toHaveBeenCalledTimes(1);
      expect((http.get as jasmine.Spy).calls.mostRecent().args).toEqual([
        expectedEndpoint,
        { observe: 'response' }
      ]);
      expect(result).toEqual({
        status: 201,
        body: { ok: true }
      });
    });
  });
});
