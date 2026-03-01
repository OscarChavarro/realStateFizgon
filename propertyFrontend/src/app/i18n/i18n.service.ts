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
      en: 'Price (€/month)',
      sp: 'Precio (€/mes)'
    },
    {
      id: 'LOCATION',
      en: 'Location',
      sp: 'Ubicación'
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
      id: 'DESCRIPTION',
      en: 'Description',
      sp: 'Descripción'
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
      id: 'LANGUAGE_LABEL',
      en: 'Language',
      sp: 'Idioma'
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
