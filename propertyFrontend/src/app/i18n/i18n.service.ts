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
      en: 'Property list',
      sp: 'Listado de propiedades'
    },
    {
      id: 'DATABASE_MAINTENANCE_TAB',
      en: 'Database',
      sp: 'Base de datos'
    },
    {
      id: 'USERS_TAB',
      en: 'Users',
      sp: 'Usuarios'
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
      id: 'FILTERS',
      en: 'Filters',
      sp: 'Filtros'
    },
    {
      id: 'SHOW_CLOSED_PROPERTIES',
      en: 'Show closed properties',
      sp: 'Mostrar propiedades cerradas'
    },
    {
      id: 'SHOWING_PROPERTIES',
      en: 'Showing',
      sp: 'Mostrando'
    },
    {
      id: 'FULLSCREEN',
      en: 'Fullscreen',
      sp: 'Pantalla completa'
    },
    {
      id: 'CYCLE_LAYOUT',
      en: 'Cycle layout',
      sp: 'Cambiar distribución'
    },
    {
      id: 'USER_MENU',
      en: 'User menu',
      sp: 'Menú de usuario'
    },
    {
      id: 'LOGIN_WITH_GOOGLE',
      en: 'Continue with Google',
      sp: 'Continuar con Google'
    },
    {
      id: 'GOOGLE_LOGIN_NOT_CONFIGURED',
      en: 'Google OAuth is not configured on backend yet.',
      sp: 'Google OAuth todavía no está configurado en el backend.'
    },
    {
      id: 'SIGNED_IN_USER',
      en: 'Signed-in user',
      sp: 'Usuario autenticado'
    },
    {
      id: 'LOGOUT',
      en: 'Logout',
      sp: 'Cerrar sesión'
    },
    {
      id: 'USER_ROLE',
      en: 'Role',
      sp: 'Rol'
    },
    {
      id: 'USER_NAME',
      en: 'Name',
      sp: 'Nombre'
    },
    {
      id: 'USER_EMAIL',
      en: 'Email',
      sp: 'Correo'
    },
    {
      id: 'USER_PERMISSIONS',
      en: 'Permissions',
      sp: 'Permisos'
    },
    {
      id: 'USER_LAST_LOGIN',
      en: 'Last login',
      sp: 'Último acceso'
    },
    {
      id: 'ACTIONS',
      en: 'Actions',
      sp: 'Acciones'
    },
    {
      id: 'DELETE_USER',
      en: 'Delete user',
      sp: 'Eliminar usuario'
    },
    {
      id: 'DELETE_USER_CURRENT_DISABLED',
      en: 'You cannot delete your own active session user.',
      sp: 'No puedes eliminar al usuario de tu sesión activa.'
    },
    {
      id: 'LOADING_USERS',
      en: 'Loading users...',
      sp: 'Cargando usuarios...'
    },
    {
      id: 'NO_USERS_FOUND',
      en: 'No users found.',
      sp: 'No se encontraron usuarios.'
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
