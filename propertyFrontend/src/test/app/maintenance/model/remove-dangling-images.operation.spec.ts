import { HttpClient, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { RemoveDanglingImagesOperation } from 'src/app/maintenance/model/remove-dangling-images.operation';

class RemoveDanglingImagesOperationMockFactory {
  static createHttpClientMock() {
    return {
      get: jasmine.createSpy('get')
    } as unknown as HttpClient;
  }
}

describe('RemoveDanglingImagesOperation', () => {
  it('should expose i18n id and call removeDanglingImages endpoint', async () => {
    // Arrange
    const operation = new RemoveDanglingImagesOperation();
    const http = RemoveDanglingImagesOperationMockFactory.createHttpClientMock();
    (http.get as jasmine.Spy).and.returnValue(
      of(new HttpResponse<unknown>({ status: 200, body: { removed: 10 } }))
    );

    // Action
    const result = await operation.execute(http);

    // Assert
    expect(operation.i18nId).toBe('maintenance.REMOVE_DANGLING_IMAGES');
    expect(http.get).toHaveBeenCalledTimes(1);
    expect((http.get as jasmine.Spy).calls.mostRecent().args).toEqual([
      '/removeDanglingImages',
      { observe: 'response' }
    ]);
    expect(result).toEqual({
      status: 200,
      body: { removed: 10 }
    });
  });
});
