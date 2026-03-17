import { TranslationValue } from 'src/app/core/i18n/types/translation-value.type';

export const MAINTENANCE_TRANSLATIONS = {
  REMOVE_DANGLING_IMAGES: {
    en: 'Remove dangling images',
    sp: 'Eliminar imágenes huérfanas'
  },
  OPERATION_RESULT: {
    en: 'Operation result',
    sp: 'Resultado de la operación'
  }
} as const satisfies Record<string, TranslationValue>;
