import { BrowserFullscreenService } from 'src/app/listing/services/browser-fullscreen.service';

describe('BrowserFullscreenService', () => {
  let service: BrowserFullscreenService;

  beforeEach(() => {
    service = new BrowserFullscreenService();
  });

  it('toggleFullscreen should exit fullscreen when fullscreenElement exists', async () => {
    // Arrange
    const exitSpy = jasmine.createSpy('exitFullscreen').and.resolveTo(undefined);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => ({})
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitSpy
    });

    // Action
    await service.toggleFullscreen();

    // Assert
    expect(exitSpy).toHaveBeenCalled();
  });

  it('toggleFullscreen should request fullscreen when not in fullscreen and requestFullscreen exists', async () => {
    // Arrange
    const requestSpy = jasmine.createSpy('requestFullscreen').and.resolveTo(undefined);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestSpy
    });

    // Action
    await service.toggleFullscreen();

    // Assert
    expect(requestSpy).toHaveBeenCalled();
  });

  it('toggleFullscreen should do nothing when requestFullscreen is not available', async () => {
    // Arrange
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: undefined
    });

    // Action
    await service.toggleFullscreen();

    // Assert
    expect().nothing();
  });
});
