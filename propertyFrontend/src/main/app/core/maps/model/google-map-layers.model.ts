import { TranslationKey } from 'src/app/core/i18n/translations/translations-by-namespace.const';

export type GoogleMapLayerId = 'business' | 'hospitals' | 'metroStations' | 'schools';

export type GoogleMapStyleRule = {
  featureType: string;
  elementType: string;
  stylers: Array<{ visibility: 'on' | 'off' }>;
};

export type GoogleMapLayerOption = {
  id: GoogleMapLayerId;
  label: TranslationKey;
  mapFeatureStyles: GoogleMapStyleRule[];
};

export type GoogleMapVisualStyleId = 'vector' | 'satellite' | 'hybrid';

export type GoogleMapVisualStyleOption = {
  id: GoogleMapVisualStyleId;
  label: TranslationKey;
};
