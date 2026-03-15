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
  setMap?: (map: GoogleMapLike | null) => void;
  map?: GoogleMapLike | null;
};

type SearchNearbyRankPreferenceLike = {
  POPULARITY?: string;
  DISTANCE?: string;
};

type NearbySearchNewPlaceLike = {
  location?: GoogleLatLngLike | { lat: number; lng: number };
  displayName?: string | { text?: string };
  types?: string[];
  primaryType?: string;
};

type NearbySearchNewRequestLike = {
  fields: string[];
  locationRestriction: {
    center: { lat: number; lng: number };
    radius: number;
  };
  includedPrimaryTypes: string[];
  maxResultCount?: number;
  rankPreference?: string;
};

type PlacesLibraryLike = {
  Place?: {
    searchNearby: (request: NearbySearchNewRequestLike) => Promise<{ places?: NearbySearchNewPlaceLike[] }>;
  };
  SearchNearbyRankPreference?: SearchNearbyRankPreferenceLike;
};

type MarkerLibraryLike = {
  AdvancedMarkerElement?: new (options: {
    map?: GoogleMapLike | null;
    position: { lat: number; lng: number };
    title?: string;
    content?: HTMLElement;
  }) => GoogleMarkerLike;
};

export type GoogleMapsApi = {
  importLibrary?: (libraryName: string) => Promise<unknown>;
};

export type GoogleMapStyleRule = {
  featureType: string;
  elementType: string;
  stylers: Array<{ visibility: 'on' | 'off' }>;
};

type NormalizedPlaceResult = {
  location?: GoogleLatLngLike | { lat: number; lng: number };
  name: string;
  types?: string[];
};

type PoiLayerContext = {
  mapInstance: GoogleMapLike | null;
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
    metroStations: true,
    schools: false,
    universities: false
  };

  readonly layerOptions: LocationLayerOption[] = [
    {
      id: 'restaurants',
      label: 'PROPERTY_LOCATION_LAYER_RESTAURANTS',
      searchType: 'restaurant',
      allowedPlaceTypes: ['restaurant', 'food', 'cafe', 'bar', 'meal_takeaway', 'meal_delivery'],
      markerColor: '#f97316',
      markerGlyph: '🍽'
    },
    {
      id: 'supermarkets',
      label: 'PROPERTY_LOCATION_LAYER_SUPERMARKETS',
      searchType: 'supermarket',
      allowedPlaceTypes: ['supermarket', 'grocery_store', 'discount_supermarket', 'hypermarket', 'food_store'],
      markerColor: '#2563eb',
      markerGlyph: '🛒'
    },
    {
      id: 'hospitals',
      label: 'PROPERTY_LOCATION_LAYER_HOSPITALS',
      searchType: 'hospital',
      allowedPlaceTypes: ['hospital'],
      markerColor: '#dc2626',
      markerGlyph: '✚'
    },
    {
      id: 'metroStations',
      label: 'PROPERTY_LOCATION_LAYER_METRO_STATIONS',
      searchType: 'subway_station',
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
      allowedPlaceTypes: ['school'],
      markerColor: '#0891b2',
      markerGlyph: '🏫'
    },
    {
      id: 'universities',
      label: 'PROPERTY_LOCATION_LAYER_UNIVERSITIES',
      searchType: 'university',
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
        this.setMarkerMap(marker, context.mapInstance);
      }
      return;
    }

    if (this.layerSearchInFlight.has(id)) {
      return;
    }

    const option = this.layerOptions.find((entry) => entry.id === id);
    const center = context.getMapCenter();
    const mapsApi = context.mapsApi;
    if (!option || !center || !context.mapInstance || !mapsApi?.importLibrary) {
      if (!mapsApi?.importLibrary) {
        console.warn(`[PropertyLocationPoiLayerManager] Google Maps importLibrary('places') is unavailable for layer "${id}".`);
      }
      return;
    }

    this.layerSearchInFlight.add(id);
    void this.fetchAndRenderLayerMarkers(id, option, center, context, mapsApi);
  }

  private async fetchAndRenderLayerMarkers(
    id: LocationLayerId,
    option: LocationLayerOption,
    center: { lat: number; lng: number },
    context: PoiLayerContext,
    mapsApi: GoogleMapsApi
  ): Promise<void> {
    try {
      const results = await this.searchNearbyPlacesNewApi(mapsApi, option, center);
      const markerLibrary = await this.loadMarkerLibrary(mapsApi);
      if (!markerLibrary?.AdvancedMarkerElement) {
        console.warn('[PropertyLocationPoiLayerManager] AdvancedMarkerElement is unavailable.');
        return;
      }
      if (!context.mapInstance || this.activeMap !== context.mapInstance) {
        return;
      }

      const markers: GoogleMarkerLike[] = [];
      for (const result of results) {
        if (!this.isResultAllowedForLayer(result, option)) {
          continue;
        }

        const lat = this.readLatLng(result.location, 'lat');
        const lng = this.readLatLng(result.location, 'lng');
        if (lat === null || lng === null) {
          continue;
        }

        const marker = new markerLibrary.AdvancedMarkerElement({
          map: this.layerSelection[id] ? context.mapInstance : null,
          position: { lat, lng },
          title: result.name,
          content: this.buildPoiMarkerContentElement(option.markerColor, option.markerGlyph)
        });
        markers.push(marker);
      }

      this.layerMarkers.set(id, markers);
    } finally {
      this.layerSearchInFlight.delete(id);
    }
  }

  private async searchNearbyPlacesNewApi(
    mapsApi: GoogleMapsApi,
    option: LocationLayerOption,
    center: { lat: number; lng: number }
  ): Promise<NormalizedPlaceResult[]> {
    try {
      const placesLibrary = (await mapsApi.importLibrary?.('places')) as PlacesLibraryLike | undefined;
      if (!placesLibrary?.Place?.searchNearby) {
        return [];
      }

      const rankPreference = placesLibrary.SearchNearbyRankPreference?.DISTANCE
        ?? placesLibrary.SearchNearbyRankPreference?.POPULARITY;

      const request: NearbySearchNewRequestLike = {
        fields: ['displayName', 'location', 'types', 'primaryType'],
        locationRestriction: {
          center,
          radius: option.searchRadiusMeters ?? 5000
        },
        includedPrimaryTypes: [option.searchType],
        maxResultCount: 20,
        rankPreference
      };

      const response = await placesLibrary.Place.searchNearby(request);
      const places = response.places ?? [];
      return places.map((place) => ({
        location: place.location,
        name: this.readDisplayName(place.displayName),
        types: this.normalizeNewApiTypes(place.types, place.primaryType)
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[PropertyLocationPoiLayerManager] Places Nearby Search failed for layer "${option.id}": ${message}`);
      return [];
    }
  }

  private normalizeNewApiTypes(types: string[] | undefined, primaryType: string | undefined): string[] | undefined {
    if (!types && !primaryType) {
      return undefined;
    }

    const merged = [...(types ?? [])];
    if (primaryType && !merged.includes(primaryType)) {
      merged.push(primaryType);
    }
    return merged;
  }

  private readDisplayName(displayName: NearbySearchNewPlaceLike['displayName']): string {
    if (typeof displayName === 'string') {
      return displayName;
    }

    if (displayName && typeof displayName.text === 'string') {
      return displayName.text;
    }

    return '';
  }

  private isResultAllowedForLayer(result: NormalizedPlaceResult, option: LocationLayerOption): boolean {
    if (!option.allowedPlaceTypes || option.allowedPlaceTypes.length === 0) {
      return true;
    }

    const resultTypes = result.types;
    if (!resultTypes || resultTypes.length === 0) {
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
      this.setMarkerMap(marker, null);
    }
  }

  private clearAllLayerMarkers(): void {
    for (const markers of this.layerMarkers.values()) {
      for (const marker of markers) {
        this.setMarkerMap(marker, null);
      }
    }
    this.layerMarkers.clear();
  }

  private async loadMarkerLibrary(mapsApi: GoogleMapsApi): Promise<MarkerLibraryLike | null> {
    if (!mapsApi.importLibrary) {
      return null;
    }

    const markerLibrary = (await mapsApi.importLibrary('marker')) as MarkerLibraryLike | undefined;
    return markerLibrary ?? null;
  }

  private setMarkerMap(marker: GoogleMarkerLike, map: GoogleMapLike | null): void {
    if (typeof marker.setMap === 'function') {
      marker.setMap(map);
      return;
    }

    marker.map = map;
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

  private buildPoiMarkerContentElement(backgroundColor: string, glyph: string): HTMLElement {
    const sanitizedGlyph = glyph.replace(/[<>&'\"]/g, '');
    const container = document.createElement('div');
    container.style.width = '30px';
    container.style.height = '30px';
    container.style.borderRadius = '50%';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = backgroundColor;
    container.style.color = '#ffffff';
    container.style.fontSize = '12px';
    container.style.lineHeight = '1';
    container.textContent = sanitizedGlyph;
    return container;
  }
}
