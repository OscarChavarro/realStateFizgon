import { TranslationKey } from 'src/app/i18n/i18n.service';

export type LocationLayerId =
  | 'restaurants'
  | 'supermarkets'
  | 'hospitals'
  | 'metroStations'
  | 'schools'
  | 'universities';

export type LocationLayerOption = {
  id: LocationLayerId;
  label: TranslationKey;
  searchType: string;
  searchKeyword?: string;
  searchRadiusMeters?: number;
  allowedPlaceTypes?: string[];
  mapFeatureStyles?: GoogleMapStyleRule[];
  markerColor: string;
  markerGlyph: string;
};

export type GoogleLatLngLike = {
  lat: () => number;
  lng: () => number;
};

export type GoogleMapLike = {
  setOptions: (options: unknown) => void;
};

export type GoogleMarkerLike = {
  setMap: (map: GoogleMapLike | null) => void;
};

export type GooglePlaceResultLike = {
  geometry?: {
    location?: GoogleLatLngLike | { lat: number; lng: number };
  };
  name?: string;
  types?: string[];
};

export type GooglePlacesServiceLike = {
  nearbySearch: (
    request: { location: { lat: number; lng: number }; radius: number; type: string; keyword?: string },
    callback: (results: GooglePlaceResultLike[] | null, status: string) => void
  ) => void;
};

export type GoogleMapsApi = {
  Marker: new (options: unknown) => GoogleMarkerLike;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  places?: {
    PlacesServiceStatus: {
      OK: string;
    };
  };
};

export type GoogleMapStyleRule = {
  featureType: string;
  elementType: string;
  stylers: Array<{ visibility: 'on' | 'off' }>;
};

type PoiLayerContext = {
  mapInstance: GoogleMapLike | null;
  placesService: GooglePlacesServiceLike | null;
  mapsApi: GoogleMapsApi | null;
  getMapCenter: () => { lat: number; lng: number } | null;
};

const MAP_BASE_STYLES: GoogleMapStyleRule[] = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit.station',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit.line',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }]
  }
];

export class PropertyLocationPoiLayerManager {
  private readonly layerMarkers = new Map<LocationLayerId, GoogleMarkerLike[]>();
  private readonly layerSearchInFlight = new Set<LocationLayerId>();
  private activeMap: GoogleMapLike | null = null;

  private readonly layerSelection: Record<LocationLayerId, boolean> = {
    restaurants: false,
    supermarkets: false,
    hospitals: false,
    metroStations: false,
    schools: false,
    universities: false
  };

  readonly layerOptions: LocationLayerOption[] = [
    {
      id: 'restaurants',
      label: 'PROPERTY_LOCATION_LAYER_RESTAURANTS',
      searchType: 'restaurant',
      allowedPlaceTypes: ['restaurant', 'meal_takeaway', 'meal_delivery', 'food', 'cafe'],
      markerColor: '#f97316',
      markerGlyph: '🍽'
    },
    {
      id: 'supermarkets',
      label: 'PROPERTY_LOCATION_LAYER_SUPERMARKETS',
      searchType: 'supermarket',
      searchKeyword: 'supermarket grocery',
      allowedPlaceTypes: ['supermarket', 'grocery_store', 'discount_supermarket', 'hypermarket', 'food_store'],
      markerColor: '#2563eb',
      markerGlyph: '🛒'
    },
    {
      id: 'hospitals',
      label: 'PROPERTY_LOCATION_LAYER_HOSPITALS',
      searchType: 'hospital',
      searchKeyword: 'hospital',
      allowedPlaceTypes: ['hospital'],
      markerColor: '#dc2626',
      markerGlyph: '✚'
    },
    {
      id: 'metroStations',
      label: 'PROPERTY_LOCATION_LAYER_METRO_STATIONS',
      searchType: 'subway_station',
      searchKeyword: 'metro station',
      allowedPlaceTypes: ['subway_station', 'transit_station', 'light_rail_station', 'train_station'],
      mapFeatureStyles: [
        { featureType: 'transit.line', elementType: 'labels', stylers: [{ visibility: 'on' }] },
        { featureType: 'transit.line', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
        { featureType: 'transit.station.rail', elementType: 'labels', stylers: [{ visibility: 'on' }] },
        { featureType: 'transit.station.rail', elementType: 'geometry', stylers: [{ visibility: 'on' }] }
      ],
      markerColor: '#7c3aed',
      markerGlyph: 'Ⓜ'
    },
    {
      id: 'schools',
      label: 'PROPERTY_LOCATION_LAYER_SCHOOLS',
      searchType: 'school',
      searchKeyword: 'school',
      allowedPlaceTypes: ['school'],
      markerColor: '#0891b2',
      markerGlyph: '🏫'
    },
    {
      id: 'universities',
      label: 'PROPERTY_LOCATION_LAYER_UNIVERSITIES',
      searchType: 'university',
      searchKeyword: 'university',
      allowedPlaceTypes: ['university'],
      markerColor: '#1f9d4d',
      markerGlyph: '🎓'
    }
  ];

  isLayerEnabled(id: LocationLayerId): boolean {
    return this.layerSelection[id];
  }

  onMapReady(context: PoiLayerContext): void {
    this.activeMap = context.mapInstance;
    this.clearAllLayerMarkers();
    this.layerSearchInFlight.clear();
    for (const option of this.layerOptions) {
      if (this.layerSelection[option.id]) {
        this.enableLayer(option.id, context);
      }
    }
    this.applyLayerStyles(context.mapInstance);
  }

  toggleLayer(id: LocationLayerId, checked: boolean, context: PoiLayerContext): void {
    this.activeMap = context.mapInstance;
    this.layerSelection[id] = checked;
    this.applyLayerStyles(context.mapInstance);
    if (!checked) {
      this.hideLayerMarkers(id);
      return;
    }

    this.enableLayer(id, context);
  }

  buildMapStyles(): GoogleMapStyleRule[] {
    const styles: GoogleMapStyleRule[] = [...MAP_BASE_STYLES];
    for (const option of this.layerOptions) {
      if (this.layerSelection[option.id] && option.mapFeatureStyles) {
        styles.push(...option.mapFeatureStyles);
      }
    }

    return styles;
  }

  private enableLayer(id: LocationLayerId, context: PoiLayerContext): void {
    const existingMarkers = this.layerMarkers.get(id);
    if (existingMarkers && existingMarkers.length > 0) {
      for (const marker of existingMarkers) {
        marker.setMap(context.mapInstance);
      }
      return;
    }

    if (this.layerSearchInFlight.has(id)) {
      return;
    }

    const option = this.layerOptions.find((entry) => entry.id === id);
    const center = context.getMapCenter();
    if (!option || !context.placesService || !center || !context.mapInstance) {
      return;
    }

    this.layerSearchInFlight.add(id);
    context.placesService.nearbySearch(
      {
        location: center,
        radius: option.searchRadiusMeters ?? 5000,
        type: option.searchType,
        keyword: option.searchKeyword
      },
      (results, status) => {
        this.layerSearchInFlight.delete(id);
        if (
          !context.mapsApi?.places
          || status !== context.mapsApi.places.PlacesServiceStatus.OK
          || !results
          || !context.mapInstance
          || this.activeMap !== context.mapInstance
        ) {
          return;
        }

        const markers: GoogleMarkerLike[] = [];
        for (const result of results) {
          if (!this.isResultAllowedForLayer(result, option)) {
            continue;
          }
          const resultLocation = result.geometry?.location;
          const lat = this.readLatLng(resultLocation, 'lat');
          const lng = this.readLatLng(resultLocation, 'lng');
          if (lat === null || lng === null) {
            continue;
          }

          const marker = new context.mapsApi.Marker({
            map: this.layerSelection[id] ? context.mapInstance : null,
            position: { lat, lng },
            title: result.name ?? '',
            icon: {
              url: this.buildPoiMarkerIconDataUrl(option.markerColor, option.markerGlyph),
              scaledSize: new context.mapsApi.Size(30, 30),
              anchor: new context.mapsApi.Point(15, 15)
            }
          });
          markers.push(marker);
        }

        this.layerMarkers.set(id, markers);
      }
    );
  }

  private isResultAllowedForLayer(result: GooglePlaceResultLike, option: LocationLayerOption): boolean {
    if (!option.allowedPlaceTypes || option.allowedPlaceTypes.length === 0) {
      return true;
    }

    const resultTypes = result.types;
    if (!resultTypes || resultTypes.length === 0) {
      // Fallback to request-level filtering when Google does not provide types in the payload.
      return true;
    }

    return resultTypes.some((type) => option.allowedPlaceTypes?.includes(type) === true);
  }

  private hideLayerMarkers(id: LocationLayerId): void {
    const markers = this.layerMarkers.get(id);
    if (!markers) {
      return;
    }

    for (const marker of markers) {
      marker.setMap(null);
    }
  }

  private clearAllLayerMarkers(): void {
    for (const markers of this.layerMarkers.values()) {
      for (const marker of markers) {
        marker.setMap(null);
      }
    }
    this.layerMarkers.clear();
  }

  private applyLayerStyles(mapInstance: GoogleMapLike | null): void {
    if (!mapInstance) {
      return;
    }

    mapInstance.setOptions({
      styles: this.buildMapStyles()
    });
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

  private buildPoiMarkerIconDataUrl(backgroundColor: string, glyph: string): string {
    const sanitizedGlyph = glyph.replace(/[<>&'"]/g, '');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="14" fill="${backgroundColor}" />
        <text x="15" y="19" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#ffffff">${sanitizedGlyph}</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
}
