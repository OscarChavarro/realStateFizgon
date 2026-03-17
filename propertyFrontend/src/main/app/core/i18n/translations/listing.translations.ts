import { TranslationValue } from 'src/app/core/i18n/types/translation-value.type';

export const LISTING_TRANSLATIONS = {
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
  AREA: {
    en: 'Area',
    sp: 'Área'
  },
  BEDROOMS: {
    en: 'Bedrooms',
    sp: 'Habitaciones'
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
  }
} as const satisfies Record<string, TranslationValue>;
