import { GoogleMapRuntimeUseCaseService } from 'src/app/core/maps/services/google-map-runtime.use-case.service';
import { GoogleMapsRuntimeLoader } from 'src/app/core/maps/services/google-maps-runtime-loader';

describe('GoogleMapRuntimeUseCaseService', () => {
  it('ensureRuntimeReady should load script and wait for runtime readiness', async () => {
    // Arrange
    const service = new GoogleMapRuntimeUseCaseService();
    const runtimeLoader = {
      loadGoogleMapsScript: jasmine.createSpy('loadGoogleMapsScript').and.resolveTo(undefined),
      waitForGoogleMapsReady: jasmine.createSpy('waitForGoogleMapsReady').and.resolveTo(undefined)
    } satisfies Pick<GoogleMapsRuntimeLoader, 'loadGoogleMapsScript' | 'waitForGoogleMapsReady'>;

    // Action
    await service.ensureRuntimeReady(runtimeLoader, 'api-key');

    // Assert
    expect(runtimeLoader.loadGoogleMapsScript).toHaveBeenCalledOnceWith('api-key');
    expect(runtimeLoader.waitForGoogleMapsReady).toHaveBeenCalled();
  });

  it('ensureRuntimeReady should bubble script loading failures', async () => {
    // Arrange
    const service = new GoogleMapRuntimeUseCaseService();
    const runtimeLoader = {
      loadGoogleMapsScript: jasmine.createSpy('loadGoogleMapsScript').and.rejectWith(
        new Error('load-error')
      ),
      waitForGoogleMapsReady: jasmine.createSpy('waitForGoogleMapsReady').and.resolveTo(undefined)
    } satisfies Pick<GoogleMapsRuntimeLoader, 'loadGoogleMapsScript' | 'waitForGoogleMapsReady'>;

    // Action
    let emittedError: unknown;
    try {
      await service.ensureRuntimeReady(runtimeLoader, 'api-key');
    } catch (error) {
      emittedError = error;
    }

    // Assert
    expect((emittedError as Error).message).toBe('load-error');
    expect(runtimeLoader.waitForGoogleMapsReady).not.toHaveBeenCalled();
  });
});
