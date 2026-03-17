import { Injectable } from '@angular/core';
import { GoogleMapsRuntimeLoader } from 'src/app/core/maps/services/google-maps-runtime-loader';

type GoogleMapsRuntimeLoaderPort = Pick<
  GoogleMapsRuntimeLoader,
  'loadGoogleMapsScript' | 'waitForGoogleMapsReady'
>;

@Injectable({
  providedIn: 'root'
})
export class GoogleMapRuntimeUseCaseService {
  async ensureRuntimeReady(
    runtimeLoader: GoogleMapsRuntimeLoaderPort,
    googleMapsApiKey: string
  ): Promise<void> {
    await runtimeLoader.loadGoogleMapsScript(googleMapsApiKey);
    await runtimeLoader.waitForGoogleMapsReady();
  }
}
