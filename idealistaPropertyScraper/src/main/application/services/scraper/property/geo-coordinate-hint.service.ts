import { Inject, Injectable, Logger } from '@nestjs/common';
import { GeoLocationHint } from 'domain/property/geo-location-hint';
import { Property } from 'domain/property/property';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { PROPERTY_READ_PORT } from 'ports/outbound/persistence/property-read.port.token';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
type GeoHintFetchMode = 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB';

type GeoHintPayload = {
  latitudeRaw?: unknown;
  longitudeRaw?: unknown;
  coordinatesRaw?: unknown;
  payload?: unknown;
};

type LatitudeLongitudeLike = {
  latitude?: unknown;
  longitude?: unknown;
  lat?: unknown;
  lon?: unknown;
};

@Injectable()
export class GeoCoordinateHintService {
  private readonly logger = new Logger(GeoCoordinateHintService.name);

  constructor(
    @Inject(PROPERTY_READ_PORT)
    private readonly propertyReadPort: PropertyReadPort
  ) {}

  async enrichProperty(
    runtime: RuntimeClient,
    property: Property,
    mode: GeoHintFetchMode
  ): Promise<Property> {
    if (mode === 'ONLY_WHEN_MISSING_IN_DB') {
      const hasHint = await this.propertyReadPort.hasGeoLocationHintByUrl(property.url);
      if (hasHint) {
        return property;
      }
    }

    const geoLocationHint = await this.fetchGeoLocationHint(runtime, property.propertyId, property.url);
    return this.withGeoLocationHint(property, geoLocationHint);
  }

  private async fetchGeoLocationHint(
    runtime: RuntimeClient,
    propertyId: string | null,
    url: string
  ): Promise<GeoLocationHint | null> {
    if (!propertyId) {
      return null;
    }

    const endpoint = `https://www.idealista.com/es/openDetailGallery/${propertyId}?isVacational=false`;
    const expression = `(() => (async () => {
      try {
        const response = await fetch(${JSON.stringify(endpoint)}, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store'
        });
        const text = await response.text();
        let payload = null;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }

        const maps = payload?.data?.multimedia?.maps ?? null;
        let coordinates = null;
        if (maps && typeof maps === 'object' && !Array.isArray(maps)) {
          coordinates = (maps.coordinates && typeof maps.coordinates === 'object')
            ? maps.coordinates
            : null;
        } else if (Array.isArray(maps)) {
          for (const mapEntry of maps) {
            if (mapEntry && typeof mapEntry === 'object' && mapEntry.coordinates && typeof mapEntry.coordinates === 'object') {
              coordinates = mapEntry.coordinates;
              break;
            }
          }
        }

        return {
          coordinatesRaw: coordinates,
          payload
        };
      } catch {
        return {
          coordinatesRaw: null,
          payload: null
        };
      }
    })())()`;

    try {
      const response = await runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (response.exceptionDetails?.text) {
        this.logger.warn(
          `Failed extracting geoLocationHint for property "${url}" due runtime exception: ${response.exceptionDetails.text}`
        );
        return null;
      }

      return this.mapGeoHintPayload(response.result?.value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed extracting geoLocationHint for property "${url}": ${message}`);
      return null;
    }
  }

  private mapGeoHintPayload(value: unknown): GeoLocationHint | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const payload = value as GeoHintPayload;
    const coordinatesRaw = this.extractCoordinates(payload);
    const lat = this.toFiniteNumber(coordinatesRaw?.latitude ?? coordinatesRaw?.lat ?? payload.latitudeRaw);
    const lon = this.toFiniteNumber(coordinatesRaw?.longitude ?? coordinatesRaw?.lon ?? payload.longitudeRaw);
    if (lat === null || lon === null) {
      return null;
    }

    return { lat, lon };
  }

  private toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number.parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private extractCoordinates(payload: GeoHintPayload): LatitudeLongitudeLike | null {
    if (this.isCoordinatesObject(payload.coordinatesRaw)) {
      return payload.coordinatesRaw;
    }

    const fromRawPayload = this.findCoordinatesInObjectGraph(payload.payload);
    if (fromRawPayload) {
      return fromRawPayload;
    }

    return null;
  }

  private withGeoLocationHint(property: Property, geoLocationHint: GeoLocationHint | null): Property {
    return property.withGeoLocationHint(geoLocationHint);
  }

  private isCoordinatesObject(value: unknown): value is LatitudeLongitudeLike {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private findCoordinatesInObjectGraph(root: unknown): LatitudeLongitudeLike | null {
    if (!this.isCoordinatesObject(root) && !Array.isArray(root)) {
      return null;
    }

    const stack: unknown[] = [root];
    const visited = new Set<unknown>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (this.isCoordinatesObject(current) && this.looksLikeCoordinateLeaf(current)) {
        return current;
      }

      if (Array.isArray(current)) {
        for (const entry of current) {
          if (typeof entry === 'object' && entry !== null) {
            stack.push(entry);
          }
        }
        continue;
      }

      for (const value of Object.values(current)) {
        if (typeof value === 'object' && value !== null) {
          stack.push(value);
        }
      }
    }

    return null;
  }

  private looksLikeCoordinateLeaf(value: LatitudeLongitudeLike): boolean {
    return (
      (value.latitude !== undefined && value.longitude !== undefined) ||
      (value.lat !== undefined && value.lon !== undefined)
    );
  }
}
