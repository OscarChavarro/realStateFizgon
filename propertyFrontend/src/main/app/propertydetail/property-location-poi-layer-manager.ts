import { TranslationKey } from 'src/app/i18n/i18n.service';

export type LocationLayerId =
  | 'business'
  | 'hospitals'
  | 'metroStations'
  | 'schools';

export type LocationLayerOption = {
  id: LocationLayerId;
  label: TranslationKey;
  placeTypeHint?: string;
  mapFeatureStyles: GoogleMapStyleRule[];
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

export type GoogleMapStyleRule = {
  featureType: string;
  elementType: string;
  stylers: Array<{ visibility: 'on' | 'off' }>;
};

type PoiLayerContext = {
  mapInstance: GoogleMapLike | null;
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
    stylers: [{ visibility: 'on' }]
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }]
  }
];

export class PropertyLocationPoiLayerManager {
  private readonly layerSelection: Record<LocationLayerId, boolean> = {
    business: false,
    hospitals: false,
    metroStations: true,
    schools: false
  };

  readonly layerOptions: LocationLayerOption[] = [
    {
      id: 'business',
      label: 'PROPERTY_LOCATION_LAYER_BUSINESS',
      mapFeatureStyles: [
        { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'on' }] },
        { featureType: 'poi.business', elementType: 'geometry', stylers: [{ visibility: 'on' }] }
      ]
    },
    {
      id: 'hospitals',
      label: 'PROPERTY_LOCATION_LAYER_HOSPITALS',
      mapFeatureStyles: [
        { featureType: 'poi.medical', elementType: 'labels', stylers: [{ visibility: 'on' }] },
        { featureType: 'poi.medical', elementType: 'geometry', stylers: [{ visibility: 'on' }] }
      ]
    },
    {
      id: 'metroStations',
      label: 'PROPERTY_LOCATION_LAYER_METRO_STATIONS',
      placeTypeHint: 'subway_station',
      mapFeatureStyles: [
        { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'on' }] },
        { featureType: 'transit.station', elementType: 'geometry', stylers: [{ visibility: 'on' }] }
      ]
    },
    {
      id: 'schools',
      label: 'PROPERTY_LOCATION_LAYER_SCHOOLS',
      mapFeatureStyles: [
        { featureType: 'poi.school', elementType: 'labels', stylers: [{ visibility: 'on' }] },
        { featureType: 'poi.school', elementType: 'geometry', stylers: [{ visibility: 'on' }] }
      ]
    }
  ];

  isLayerEnabled(id: LocationLayerId): boolean {
    return this.layerSelection[id];
  }

  onMapReady(context: PoiLayerContext): void {
    this.applyLayerStyles(context.mapInstance);
  }

  toggleLayer(id: LocationLayerId, checked: boolean, context: PoiLayerContext): void {
    this.layerSelection[id] = checked;
    this.applyLayerStyles(context.mapInstance);
  }

  buildMapStyles(): GoogleMapStyleRule[] {
    const styles: GoogleMapStyleRule[] = [...MAP_BASE_STYLES];
    const dedupe = new Set<string>();

    for (const option of this.layerOptions) {
      if (!this.layerSelection[option.id]) {
        continue;
      }

      for (const rule of option.mapFeatureStyles) {
        const key = `${rule.featureType}|${rule.elementType}|${rule.stylers.map((styler) => styler.visibility).join(',')}`;
        if (dedupe.has(key)) {
          continue;
        }

        dedupe.add(key);
        styles.push(rule);
      }
    }

    return styles;
  }

  private applyLayerStyles(mapInstance: GoogleMapLike | null): void {
    if (!mapInstance) {
      return;
    }

    mapInstance.setOptions({
      styles: this.buildMapStyles()
    });
  }
}
