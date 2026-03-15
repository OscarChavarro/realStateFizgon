import { Injectable } from '@angular/core';

export type SupportedLanguage = 'en' | 'sp';

type TranslationValue = {
  en: string;
  sp: string;
};

const TRANSLATIONS = {
  DASHBOARD: {
    en: 'Listing',
    sp: 'Listado'
  },
  MAP_TAB: {
    en: 'Map',
    sp: 'Mapa'
  },
  DATABASE_MAINTENANCE_TAB: {
    en: 'Database',
    sp: 'Base de datos'
  },
  USERS_TAB: {
    en: 'Users',
    sp: 'Usuarios'
  },
  LANGUAGE_EN: {
    en: 'English 🇺🇸',
    sp: 'Inglés 🇺🇸'
  },
  LANGUAGE_SP: {
    en: 'Spanish 🇪🇸',
    sp: 'Español 🇪🇸'
  },
  FILTERS: {
    en: 'Filters',
    sp: 'Filtros'
  },
  SHOW_CLOSED_PROPERTIES: {
    en: 'Show closed properties',
    sp: 'Mostrar propiedades cerradas'
  },
  SHOW_REVIEW_NEW: {
    en: 'Show review: New',
    sp: 'Mostrar revisión: Nuevo'
  },
  SHOW_REVIEW_FAVOURITE: {
    en: 'Show review: Favourite',
    sp: 'Mostrar revisión: Favorito'
  },
  SHOW_REVIEW_REJECTED: {
    en: 'Show review: Rejected',
    sp: 'Mostrar revisión: Rechazado'
  },
  MIN_PUBLICATION_DATE: {
    en: 'Min publication date',
    sp: 'Mínima fecha de publicación'
  },
  MAX_PUBLICATION_DATE: {
    en: 'Max publication date',
    sp: 'Máxima fecha de publicación'
  },
  PRICE_RANGE: {
    en: 'Price range',
    sp: 'Rango de precio'
  },
  MIN_PRICE: {
    en: 'Min price',
    sp: 'Precio mínimo'
  },
  MAX_PRICE: {
    en: 'Max price',
    sp: 'Precio máximo'
  },
  LOADING_PRICE_RANGE: {
    en: 'Loading price range...',
    sp: 'Cargando rango de precio...'
  },
  PRICE_RANGE_NOT_AVAILABLE: {
    en: 'Price range is not available.',
    sp: 'El rango de precio no está disponible.'
  },
  SHOWING_PROPERTIES: {
    en: 'Showing',
    sp: 'Mostrando'
  },
  FULLSCREEN: {
    en: 'Fullscreen',
    sp: 'Pantalla completa'
  },
  CYCLE_LAYOUT: {
    en: 'Cycle layout',
    sp: 'Cambiar distribución'
  },
  USER_MENU: {
    en: 'User menu',
    sp: 'Menú de usuario'
  },
  LOGIN_WITH_GOOGLE: {
    en: 'Continue with Google',
    sp: 'Continuar con Google'
  },
  GOOGLE_LOGIN_NOT_CONFIGURED: {
    en: 'Google OAuth is not configured on backend yet.',
    sp: 'Google OAuth todavía no está configurado en el backend.'
  },
  SIGNED_IN_USER: {
    en: 'Signed-in user',
    sp: 'Usuario autenticado'
  },
  LOGOUT: {
    en: 'Logout',
    sp: 'Cerrar sesión'
  },
  USER_ROLE: {
    en: 'Role',
    sp: 'Rol'
  },
  USER_NAME: {
    en: 'Name',
    sp: 'Nombre'
  },
  USER_EMAIL: {
    en: 'Email',
    sp: 'Correo'
  },
  USER_PERMISSIONS: {
    en: 'Permissions',
    sp: 'Permisos'
  },
  USER_LAST_LOGIN: {
    en: 'Last login',
    sp: 'Último acceso'
  },
  ACTIONS: {
    en: 'Actions',
    sp: 'Acciones'
  },
  DELETE_USER: {
    en: 'Delete user',
    sp: 'Eliminar usuario'
  },
  DELETE_USER_CURRENT_DISABLED: {
    en: 'You cannot delete your own active session user.',
    sp: 'No puedes eliminar al usuario de tu sesión activa.'
  },
  LOADING_USERS: {
    en: 'Loading users...',
    sp: 'Cargando usuarios...'
  },
  NO_USERS_FOUND: {
    en: 'No users found.',
    sp: 'No se encontraron usuarios.'
  },
  PUBLICATION_DATE: {
    en: 'Published on',
    sp: 'Publicado en'
  },
  TITLE: {
    en: 'Title',
    sp: 'Título'
  },
  PRICE: {
    en: 'Price (€/month)',
    sp: 'Precio (€/mes)'
  },
  REVIEW_COLUMN: {
    en: 'Review',
    sp: 'Revisión'
  },
  REVIEW_NEW: {
    en: 'New!',
    sp: 'Nuevo!'
  },
  REVIEW_FAVOURITE: {
    en: 'Favourite',
    sp: 'Favorito'
  },
  REVIEW_DISCHARGED: {
    en: 'Rejected',
    sp: 'Rechazado'
  },
  COMMENT: {
    en: 'Comment',
    sp: 'Comentario'
  },
  COMMENT_PLACEHOLDER: {
    en: 'Write a note...',
    sp: 'Escribe una nota...'
  },
  LOCATION: {
    en: 'Location',
    sp: 'Ubicación'
  },
  PROPERTY_DETAIL_SOURCE: {
    en: 'Source',
    sp: 'Fuente'
  },
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
  },
  DESCRIPTION: {
    en: 'Description',
    sp: 'Descripción'
  },
  SORT_ASC: {
    en: 'Sort ascending',
    sp: 'Orden ascendente'
  },
  SORT_DESC: {
    en: 'Sort descending',
    sp: 'Orden descendente'
  },
  SORT_DISABLED: {
    en: 'Disable sorting',
    sp: 'Desactivar orden'
  },
  NO_PROPERTIES_FOUND: {
    en: 'No properties found',
    sp: 'No se encontraron propiedades'
  },
  PAGINATION_PAGE: {
    en: 'Page',
    sp: 'Página'
  },
  PAGINATION_OF: {
    en: 'of',
    sp: 'de'
  },
  PAGINATION_TOTAL_ITEMS: {
    en: 'Total items',
    sp: 'Total elementos'
  },
  PAGINATION_PAGE_SIZE: {
    en: 'Page size',
    sp: 'Tamaño de página'
  },
  PAGINATION_PREVIOUS: {
    en: 'Previous page',
    sp: 'Página anterior'
  },
  PAGINATION_NEXT: {
    en: 'Next page',
    sp: 'Página siguiente'
  },
  REMOVE_DANGLING_IMAGES: {
    en: 'Remove dangling images',
    sp: 'Eliminar imágenes huérfanas'
  },
  OPERATION_RESULT: {
    en: 'Operation result',
    sp: 'Resultado de la operación'
  }
} as const satisfies Record<string, TranslationValue>;

export type TranslationKey = keyof typeof TRANSLATIONS;

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  get(id: TranslationKey, language: SupportedLanguage): string {
    return TRANSLATIONS[id][language];
  }
}
