import { AUTH_TRANSLATIONS } from 'src/app/core/i18n/translations/auth.translations';
import { LISTING_TRANSLATIONS } from 'src/app/core/i18n/translations/listing.translations';
import { MAINTENANCE_TRANSLATIONS } from 'src/app/core/i18n/translations/maintenance.translations';
import { MAP_TRANSLATIONS } from 'src/app/core/i18n/translations/map.translations';
import { PROPERTY_TRANSLATIONS } from 'src/app/core/i18n/translations/property.translations';
import { SHELL_TRANSLATIONS } from 'src/app/core/i18n/translations/shell.translations';

export const TRANSLATIONS_BY_NAMESPACE = {
  shell: SHELL_TRANSLATIONS,
  listing: LISTING_TRANSLATIONS,
  auth: AUTH_TRANSLATIONS,
  property: PROPERTY_TRANSLATIONS,
  map: MAP_TRANSLATIONS,
  maintenance: MAINTENANCE_TRANSLATIONS
} as const;

export type TranslationNamespace = keyof typeof TRANSLATIONS_BY_NAMESPACE;
type NamespaceTranslations<N extends TranslationNamespace> = (typeof TRANSLATIONS_BY_NAMESPACE)[N];
type NamespaceTranslationKey<N extends TranslationNamespace> = Extract<
  keyof NamespaceTranslations<N>,
  string
>;

export type TranslationKey = {
  [N in TranslationNamespace]: `${N}.${NamespaceTranslationKey<N>}`;
}[TranslationNamespace];
