import { Injectable } from '@angular/core';

export type SupportedLanguage = 'en' | 'sp';

type TranslationEntry = {
  id: string;
  en: string;
  sp: string;
};

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly translations: TranslationEntry[] = [
    {
      id: 'DASHBOARD',
      en: 'Dashboard',
      sp: 'Tablero'
    },
    {
      id: 'DATABASE_MAINTENANCE_TAB',
      en: 'Database',
      sp: 'Base de datos'
    },
    {
      id: 'LANGUAGE_EN',
      en: 'English 🇺🇸',
      sp: 'Inglés 🇺🇸'
    },
    {
      id: 'LANGUAGE_SP',
      en: 'Spanish 🇪🇸',
      sp: 'Español 🇪🇸'
    },
    {
      id: 'PROPERTIES_DASHBOARD_TITLE',
      en: 'Properties Dashboard',
      sp: 'Tablero de propiedades'
    },
    {
      id: 'TOTAL_PROPERTIES',
      en: 'Total properties',
      sp: 'Total de propiedades'
    },
    {
      id: 'CREATED_AT',
      en: 'Created at',
      sp: 'Creado en'
    },
    {
      id: 'TITLE',
      en: 'Title',
      sp: 'Título'
    },
    {
      id: 'PRICE',
      en: 'Price',
      sp: 'Precio'
    },
    {
      id: 'PROPERTY_DETAIL_SOURCE',
      en: 'Source',
      sp: 'Fuente'
    },
    {
      id: 'PROPERTY_DETAIL_LOCAL_IMAGE_FILES',
      en: 'Local image files',
      sp: 'Archivos de imagen locales'
    },
    {
      id: 'SORT_ASC',
      en: 'Sort ascending',
      sp: 'Orden ascendente'
    },
    {
      id: 'SORT_DESC',
      en: 'Sort descending',
      sp: 'Orden descendente'
    },
    {
      id: 'NO_PROPERTIES_FOUND',
      en: 'No properties found',
      sp: 'No se encontraron propiedades'
    },
    {
      id: 'LAST_UPDATE',
      en: 'Last update',
      sp: 'Última actualización'
    },
    {
      id: 'WAITING',
      en: 'waiting...',
      sp: 'esperando...'
    },
    {
      id: 'LANGUAGE_LABEL',
      en: 'Language',
      sp: 'Idioma'
    },
    {
      id: 'DATABASE_MAINTENANCE_INFO',
      en: 'Database maintenance operations are available from backend endpoints.',
      sp: 'Las operaciones de mantenimiento de base de datos están disponibles desde los endpoints del backend.'
    },
    {
      id: 'REMOVE_DANGLING_IMAGES',
      en: 'Remove dangling images',
      sp: 'Eliminar imágenes huérfanas'
    },
    {
      id: 'OPERATION_RESULT',
      en: 'Operation result',
      sp: 'Resultado de la operación'
    }
  ];

  get(id: string, language: SupportedLanguage): string {
    const entry = this.translations.find((item) => item.id === id);
    if (!entry) {
      return id;
    }

    return language === 'sp' ? entry.sp : entry.en;
  }
}
