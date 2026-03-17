import { TranslationValue } from 'src/app/core/i18n/types/translation-value.type';

export const PROPERTY_TRANSLATIONS = {
  LOCATION: {
    en: 'Location',
    sp: 'Ubicación'
  },
  PROPERTY_DETAIL_SOURCE: {
    en: 'Source',
    sp: 'Fuente'
  },
  DESCRIPTION: {
    en: 'Description',
    sp: 'Descripción'
  },
  PROPERTY_MINI_SUMMARY_MONTH_UNIT: {
    en: 'month',
    sp: 'mes'
  }
} as const satisfies Record<string, TranslationValue>;
