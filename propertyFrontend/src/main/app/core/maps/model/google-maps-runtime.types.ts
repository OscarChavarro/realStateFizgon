import { GoogleMapLike as PoiGoogleMapLike } from 'src/app/core/maps/services/google-map-poi-layer-manager';

export type GoogleLatLngLike = {
  lat: () => number;
  lng: () => number;
};

export type GoogleMapWithCenter = PoiGoogleMapLike & {
  getCenter: () => GoogleLatLngLike | { lat: number; lng: number } | null;
};

export type GoogleMarkerLike = {
  setMap: (map: GoogleMapWithCenter | null) => void;
  addListener?: (eventName: string, handler: () => void) => unknown;
};

export type GoogleMapsApi = {
  Map: new (container: HTMLElement, options: unknown) => GoogleMapWithCenter;
  Marker: new (options: unknown) => GoogleMarkerLike;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  event?: {
    trigger: (instance: unknown, eventName: string) => void;
  };
};

export type GoogleMapViewport = {
  center: { lat: number; lng: number };
  zoom: number;
};
