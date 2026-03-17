import { GoogleMapsApi } from 'src/app/core/maps/model/google-maps-runtime.types';

export class GoogleMapsRuntimeLoader {
  private static googleMapsScriptPromise: Promise<void> | null = null;

  getGoogleMaps(): GoogleMapsApi | null {
    const globalWindow = window as Window & { google?: { maps?: unknown } };
    if (!globalWindow.google || !globalWindow.google.maps) {
      return null;
    }

    return globalWindow.google.maps as GoogleMapsApi;
  }

  loadGoogleMapsScript(apiKey: string): Promise<void> {
    if (this.getGoogleMaps()) {
      return Promise.resolve();
    }

    if (GoogleMapsRuntimeLoader.googleMapsScriptPromise) {
      return GoogleMapsRuntimeLoader.googleMapsScriptPromise;
    }

    GoogleMapsRuntimeLoader.googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-google-maps-api="true"]'
      );
      if (existingScript) {
        if (this.getGoogleMaps()) {
          resolve();
          return;
        }

        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener(
          'error',
          (event) => reject(new Error(`Failed loading Google Maps script: ${String(event)}`)),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset['googleMapsApi'] = 'true';
      script.onload = () => resolve();
      script.onerror = (event) =>
        reject(new Error(`Failed loading Google Maps script: ${String(event)}`));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      GoogleMapsRuntimeLoader.googleMapsScriptPromise = null;
      throw error;
    });

    return GoogleMapsRuntimeLoader.googleMapsScriptPromise;
  }

  async waitForGoogleMapsReady(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.getGoogleMaps()) {
        return;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error('Google Maps namespace did not become available after script load.');
  }
}
