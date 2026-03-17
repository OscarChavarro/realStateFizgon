import { Injectable } from '@angular/core';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import {
  FrontendSecrets,
  ListingConfiguration
} from 'src/app/listing/model/listing-data.payload.types';

@Injectable({
  providedIn: 'root'
})
export class ListingConfigurationPayloadMapperService {
  toListingConfiguration(secrets: FrontendSecrets | null | undefined): ListingConfiguration {
    const configuredBaseUrl = secrets?.backend?.baseUrl?.trim();
    const configuredStaticMedia = secrets?.staticMedia?.trim();

    return {
      backendBaseUrl: configuredBaseUrl
        ? this.normalizeBackendBaseUrl(configuredBaseUrl)
        : ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL,
      staticMediaBaseUrl: configuredStaticMedia
        ? this.normalizeStaticMediaBaseUrl(configuredStaticMedia)
        : ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL,
      googleMapsApiKey: this.normalizeGoogleMapsApiKey(secrets?.google?.maps?.['api-key']),
      googleMapsMapId: this.normalizeGoogleMapsMapId(secrets?.google?.maps?.['map-id'])
    };
  }

  normalizeBackendBaseUrl(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
  }

  normalizeStaticMediaBaseUrl(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
  }

  normalizeGoogleMapsApiKey(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  normalizeGoogleMapsMapId(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
