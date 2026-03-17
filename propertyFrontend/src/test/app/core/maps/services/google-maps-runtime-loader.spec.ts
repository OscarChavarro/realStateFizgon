import { GoogleMapsRuntimeLoader } from 'src/app/core/maps/services/google-maps-runtime-loader';

class GoogleMapsRuntimeLoaderMockFactory {
  static resetGlobalState(): void {
    (GoogleMapsRuntimeLoader as any).googleMapsScriptPromise = null;
    delete (window as any).google;
    document
      .querySelectorAll('script[data-google-maps-api="true"]')
      .forEach((element) => element.remove());
  }

  static setGoogleMapsNamespace(namespace: unknown = {}): void {
    (window as any).google = { maps: namespace };
  }

  static appendExistingGoogleMapsScript(): HTMLScriptElement {
    const script = document.createElement('script');
    script.dataset['googleMapsApi'] = 'true';
    document.head.appendChild(script);
    return script;
  }
}

describe('GoogleMapsRuntimeLoader', () => {
  let loader: GoogleMapsRuntimeLoader;

  beforeEach(() => {
    GoogleMapsRuntimeLoaderMockFactory.resetGlobalState();
    loader = new GoogleMapsRuntimeLoader();
  });

  afterEach(() => {
    GoogleMapsRuntimeLoaderMockFactory.resetGlobalState();
  });

  it('getGoogleMaps should return null when namespace is unavailable', () => {
    // Arrange

    // Action
    const googleMaps = loader.getGoogleMaps();

    // Assert
    expect(googleMaps).toBeNull();
  });

  it('getGoogleMaps should return maps namespace when available', () => {
    // Arrange
    const mapsNamespace = { Marker: 'marker' };
    GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace(mapsNamespace);

    // Action
    const googleMaps = loader.getGoogleMaps();

    // Assert
    expect(googleMaps).toEqual(mapsNamespace as any);
  });

  it('loadGoogleMapsScript should resolve immediately when maps namespace already exists', async () => {
    // Arrange
    GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace({ ready: true });

    // Action
    await loader.loadGoogleMapsScript('api-key');

    // Assert
    expect(document.querySelector('script[data-google-maps-api="true"]')).toBeNull();
  });

  it('loadGoogleMapsScript should return existing static promise when one is already set', async () => {
    // Arrange
    const existingPromise = Promise.resolve();
    (GoogleMapsRuntimeLoader as any).googleMapsScriptPromise = existingPromise;

    // Action
    const resultPromise = loader.loadGoogleMapsScript('api-key');
    await resultPromise;

    // Assert
    expect(resultPromise).toBe(existingPromise);
  });

  it('loadGoogleMapsScript should resolve from existing script load event', async () => {
    // Arrange
    const script = GoogleMapsRuntimeLoaderMockFactory.appendExistingGoogleMapsScript();
    const promise = loader.loadGoogleMapsScript('api-key');

    // Action
    GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace({ ready: true });
    script.dispatchEvent(new Event('load'));
    await promise;

    // Assert
    expect((GoogleMapsRuntimeLoader as any).googleMapsScriptPromise).toBeTruthy();
  });

  it('loadGoogleMapsScript should resolve from existing script when maps namespace appears before listeners', async () => {
    // Arrange
    GoogleMapsRuntimeLoaderMockFactory.appendExistingGoogleMapsScript();
    GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace({ ready: true });

    // Action
    await loader.loadGoogleMapsScript('api-key');

    // Assert
    expect((GoogleMapsRuntimeLoader as any).googleMapsScriptPromise).toBeNull();
  });

  it('loadGoogleMapsScript should resolve immediately from existing script branch when second getGoogleMaps call is ready', async () => {
    // Arrange
    GoogleMapsRuntimeLoaderMockFactory.appendExistingGoogleMapsScript();
    spyOn(loader, 'getGoogleMaps').and.returnValues(null, {} as any);

    // Action
    await loader.loadGoogleMapsScript('api-key');

    // Assert
    expect(loader.getGoogleMaps).toHaveBeenCalledTimes(2);
  });

  it('loadGoogleMapsScript should reject from existing script error event and reset static promise', async () => {
    // Arrange
    const script = GoogleMapsRuntimeLoaderMockFactory.appendExistingGoogleMapsScript();
    const promise = loader.loadGoogleMapsScript('api-key');

    // Action
    script.dispatchEvent(new Event('error'));

    // Assert
    await expectAsync(promise).toBeRejectedWithError(/Failed loading Google Maps script/);
    expect((GoogleMapsRuntimeLoader as any).googleMapsScriptPromise).toBeNull();
  });

  it('loadGoogleMapsScript should create script and resolve on script load', async () => {
    // Arrange
    let appendedScript: HTMLScriptElement | null = null;
    const appendChildSpy = spyOn(document.head, 'appendChild').and.callFake(
      <T extends Node>(node: T): T => {
        const script = node as unknown as HTMLScriptElement;
        appendedScript = script;
        GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace({ ready: true });
        setTimeout(() => {
          script.onload?.(new Event('load'));
        }, 0);
        return node;
      }
    );

    // Action
    await loader.loadGoogleMapsScript('abc=123');
    const script = appendedScript as unknown as HTMLScriptElement;

    // Assert
    expect(appendChildSpy).toHaveBeenCalled();
    expect(script).toBeTruthy();
    expect(script.src).toContain('https://maps.googleapis.com/maps/api/js?key=abc%3D123&v=weekly');
    expect(script.async).toBeTrue();
    expect(script.defer).toBeTrue();
    expect(script.dataset['googleMapsApi']).toBe('true');
  });

  it('loadGoogleMapsScript should reject on script error and reset static promise', async () => {
    // Arrange
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(node: T): T => {
      const script = node as unknown as HTMLScriptElement;
      setTimeout(() => {
        script.onerror?.(new Event('error'));
      }, 0);
      return node;
    });

    // Action
    const promise = loader.loadGoogleMapsScript('api-key');

    // Assert
    await expectAsync(promise).toBeRejectedWithError(/Failed loading Google Maps script/);
    expect((GoogleMapsRuntimeLoader as any).googleMapsScriptPromise).toBeNull();
  });

  it('waitForGoogleMapsReady should resolve immediately when namespace exists', async () => {
    // Arrange
    GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace({ ready: true });

    // Action
    await loader.waitForGoogleMapsReady(10);

    // Assert
    expect(loader.getGoogleMaps()).toEqual({ ready: true } as any);
  });

  it('waitForGoogleMapsReady should support default timeout argument', async () => {
    // Arrange
    GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace({ ready: true });

    // Action
    await loader.waitForGoogleMapsReady();

    // Assert
    expect(loader.getGoogleMaps()).toEqual({ ready: true } as any);
  });

  it('waitForGoogleMapsReady should resolve when namespace appears within timeout', async () => {
    // Arrange
    setTimeout(() => {
      GoogleMapsRuntimeLoaderMockFactory.setGoogleMapsNamespace({ ready: true });
    }, 60);

    // Action
    await loader.waitForGoogleMapsReady(250);

    // Assert
    expect(loader.getGoogleMaps()).toEqual({ ready: true } as any);
  });

  it('waitForGoogleMapsReady should reject when namespace does not appear before timeout', async () => {
    // Arrange

    // Action
    const promise = loader.waitForGoogleMapsReady(20);

    // Assert
    await expectAsync(promise).toBeRejectedWithError(
      'Google Maps namespace did not become available after script load.'
    );
  });
});
