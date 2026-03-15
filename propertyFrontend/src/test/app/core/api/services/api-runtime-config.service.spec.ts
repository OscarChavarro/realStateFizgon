import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';

describe('ApiRuntimeConfigService', () => {
  let service: ApiRuntimeConfigService;

  beforeEach(() => {
    service = new ApiRuntimeConfigService();
  });

  it('whenNotConfigured_getters_shouldReturnDefaults', () => {
    expect(service.getBackendBaseUrl()).toBe(ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL);
    expect(service.getStaticMediaBaseUrl()).toBe(ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL);
  });

  it('whenConfigurationHasWhitespacesAndSlashes_setConfiguration_shouldNormalizeValues', () => {
    service.setConfiguration({
      backendBaseUrl: '  https://api.example.com/  ',
      staticMediaBaseUrl: '  https://cdn.example.com  '
    });

    expect(service.getBackendBaseUrl()).toBe('https://api.example.com');
    expect(service.getStaticMediaBaseUrl()).toBe('https://cdn.example.com/');
  });

  it('whenConfigurationHasEmptyValues_setConfiguration_shouldFallbackToDefaults', () => {
    service.setConfiguration({
      backendBaseUrl: '   ',
      staticMediaBaseUrl: '   '
    });

    expect(service.getBackendBaseUrl()).toBe(ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL);
    expect(service.getStaticMediaBaseUrl()).toBe(ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL);
  });

  it('whenResolveBackendUrlReceivesAbsoluteUrl_shouldReturnOriginalUrl', () => {
    const absoluteUrl = 'https://external.example.com/path';

    expect(service.resolveBackendUrl(absoluteUrl)).toBe(absoluteUrl);
  });

  it('whenResolveBackendUrlReceivesRelativePath_shouldPrefixBackendUrl', () => {
    service.setConfiguration({
      backendBaseUrl: 'https://api.example.com',
      staticMediaBaseUrl: 'https://cdn.example.com/'
    });

    expect(service.resolveBackendUrl('/auth/session')).toBe('https://api.example.com/auth/session');
    expect(service.resolveBackendUrl('properties')).toBe('https://api.example.com/properties');
  });

  it('whenShouldRouteToBackendReceivesStaticFiles_shouldReturnFalse', () => {
    expect(service.shouldRouteToBackend('/secrets.json')).toBeFalse();
    expect(service.shouldRouteToBackend('/assets/logo.png')).toBeFalse();
  });

  it('whenShouldRouteToBackendReceivesSupportedRelativePaths_shouldReturnTrue', () => {
    const routablePaths = ['/auth/session', '/properties', 'properties', '/properties/count', '/removeDanglingImages'];

    routablePaths.forEach((path) => {
      expect(service.shouldRouteToBackend(path)).toBeTrue();
    });
  });

  it('whenShouldRouteToBackendReceivesUnsupportedRelativePath_shouldReturnFalse', () => {
    expect(service.shouldRouteToBackend('/health')).toBeFalse();
  });

  it('whenShouldRouteToBackendReceivesAbsoluteBackendUrl_shouldReturnTrue', () => {
    service.setConfiguration({
      backendBaseUrl: 'https://backend.example.com',
      staticMediaBaseUrl: 'https://cdn.example.com/'
    });

    expect(service.shouldRouteToBackend('https://backend.example.com/properties')).toBeTrue();
  });

  it('whenShouldRouteToBackendReceivesAbsoluteNonBackendUrl_shouldReturnFalse', () => {
    service.setConfiguration({
      backendBaseUrl: 'https://backend.example.com',
      staticMediaBaseUrl: 'https://cdn.example.com/'
    });

    expect(service.shouldRouteToBackend('https://other.example.com/properties')).toBeFalse();
  });

  it('whenBackendBaseUrlIsInvalidAndAbsoluteUrlIsChecked_shouldReturnFalseWithoutThrowing', () => {
    service.setConfiguration({
      backendBaseUrl: '::::',
      staticMediaBaseUrl: 'https://cdn.example.com/'
    });

    expect(service.shouldRouteToBackend('https://backend.example.com/properties')).toBeFalse();
  });
});
