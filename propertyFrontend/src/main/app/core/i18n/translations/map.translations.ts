import { TranslationValue } from 'src/app/core/i18n/types/translation-value.type';

export const MAP_TRANSLATIONS = {
  PROPERTY_LOCATION_OPEN: {
    en: 'Open location',
    sp: 'Abrir ubicación'
  },
  PROPERTY_LOCATION_CLOSE: {
    en: 'Close location dialog',
    sp: 'Cerrar diálogo de ubicación'
  },
  PROPERTY_LOCATION_LAYERS_TITLE: {
    en: 'Layers',
    sp: 'Capas'
  },
  PROPERTY_LOCATION_STYLES_TITLE: {
    en: 'Styles',
    sp: 'Estilos'
  },
  PROPERTY_LOCATION_STYLE_VECTOR: {
    en: 'Vector',
    sp: 'Vector'
  },
  PROPERTY_LOCATION_STYLE_SATELLITE: {
    en: 'Satellite',
    sp: 'Satélite'
  },
  PROPERTY_LOCATION_STYLE_HYBRID: {
    en: 'Hybrid',
    sp: 'Híbrido'
  },
  PROPERTY_LOCATION_PANEL_HIDE: {
    en: 'Hide layers panel',
    sp: 'Ocultar panel de capas'
  },
  PROPERTY_LOCATION_PANEL_SHOW: {
    en: 'Show layers panel',
    sp: 'Mostrar panel de capas'
  },
  PROPERTY_LOCATION_LAYER_BUSINESS: {
    en: 'Business',
    sp: 'Negocios'
  },
  PROPERTY_LOCATION_LAYER_HOSPITALS: {
    en: 'Hospitals',
    sp: 'Hospitales'
  },
  PROPERTY_LOCATION_LAYER_METRO_STATIONS: {
    en: 'Metro stations',
    sp: 'Estaciones de metro'
  },
  PROPERTY_LOCATION_LAYER_SCHOOLS: {
    en: 'Schools',
    sp: 'Colegios'
  },
  PROPERTY_LOCATION_MAP_NOT_CONFIGURED: {
    en: 'Google Maps API key is not configured.',
    sp: 'La API key de Google Maps no está configurada.'
  },
  PROPERTY_LOCATION_MAP_MISSING_COORDINATES: {
    en: 'Coordinates are not available for this property.',
    sp: 'No hay coordenadas disponibles para esta propiedad.'
  },
  PROPERTY_LOCATION_MAP_LOAD_ERROR: {
    en: 'Google Maps could not be loaded.',
    sp: 'No se pudo cargar Google Maps.'
  },
  PROPERTY_MINI_CAROUSEL_PREVIOUS_IMAGE: {
    en: 'Previous image',
    sp: 'Imagen anterior'
  },
  PROPERTY_MINI_CAROUSEL_NEXT_IMAGE: {
    en: 'Next image',
    sp: 'Imagen siguiente'
  }
} as const satisfies Record<string, TranslationValue>;
