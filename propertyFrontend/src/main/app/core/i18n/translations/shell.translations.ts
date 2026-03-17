import { TranslationValue } from 'src/app/core/i18n/types/translation-value.type';

export const SHELL_TRANSLATIONS = {
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
  }
} as const satisfies Record<string, TranslationValue>;
