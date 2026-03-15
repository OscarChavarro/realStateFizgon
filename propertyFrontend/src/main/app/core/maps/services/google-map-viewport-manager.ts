import {
  GoogleLatLngLike,
  GoogleMapsApi,
  GoogleMapViewport,
  GoogleMapWithCenter
} from 'src/app/core/maps/model/google-maps-runtime.types';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

export class GoogleMapViewportManager {
  resolveViewport(
    properties: GoogleMapProperty[],
    singlePropertyZoom: number
  ): GoogleMapViewport {
    if (properties.length <= 1) {
      return {
        center: { lat: properties[0].latitude, lng: properties[0].longitude },
        zoom: singlePropertyZoom
      };
    }

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    for (const property of properties) {
      minLat = Math.min(minLat, property.latitude);
      maxLat = Math.max(maxLat, property.latitude);
      minLng = Math.min(minLng, property.longitude);
      maxLng = Math.max(maxLng, property.longitude);
    }

    return {
      center: {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2
      },
      zoom: 10
    };
  }

  applyViewportToMap(mapInstance: GoogleMapWithCenter | null, viewport: GoogleMapViewport): void {
    if (!mapInstance) {
      return;
    }

    mapInstance.setOptions({
      center: viewport.center,
      zoom: viewport.zoom
    });
  }

  centerMapOnProperty(mapInstance: GoogleMapWithCenter | null, property: GoogleMapProperty): void {
    if (!mapInstance) {
      return;
    }

    mapInstance.setOptions({
      center: {
        lat: property.latitude,
        lng: property.longitude
      }
    });
  }

  refreshMapViewport(mapInstance: GoogleMapWithCenter | null, googleMaps: GoogleMapsApi | null): void {
    if (!mapInstance) {
      return;
    }

    const center = this.getMapCenter(mapInstance);
    if (googleMaps?.event) {
      googleMaps.event.trigger(mapInstance, 'resize');
    }

    if (center) {
      mapInstance.setOptions({ center });
    }
  }

  private getMapCenter(mapInstance: GoogleMapWithCenter): { lat: number; lng: number } | null {
    const center = mapInstance.getCenter();
    const lat = this.readLatLng(center, 'lat');
    const lng = this.readLatLng(center, 'lng');
    if (lat === null || lng === null) {
      return null;
    }

    return { lat, lng };
  }

  private readLatLng(
    source: GoogleLatLngLike | { lat: number; lng: number } | null | undefined,
    axis: 'lat' | 'lng'
  ): number | null {
    if (!source) {
      return null;
    }

    const value = source[axis];
    const numeric = typeof value === 'function' ? value() : value;
    return Number.isFinite(numeric) ? numeric : null;
  }
}
