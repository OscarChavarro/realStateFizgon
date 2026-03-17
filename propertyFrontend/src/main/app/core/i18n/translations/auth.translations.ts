import { TranslationValue } from 'src/app/core/i18n/types/translation-value.type';

export const AUTH_TRANSLATIONS = {
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
  }
} as const satisfies Record<string, TranslationValue>;
