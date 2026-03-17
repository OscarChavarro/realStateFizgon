import {
  TRANSLATIONS_BY_NAMESPACE,
  TranslationNamespace
} from 'src/app/core/i18n/translations/translations-by-namespace.const';
import { TranslationValue } from 'src/app/core/i18n/types/translation-value.type';

type NamespaceKeyMap<N extends TranslationNamespace, T extends Record<string, TranslationValue>> = {
  [K in keyof T]: `${N}.${Extract<K, string>}`;
};

function createNamespaceKeys<
  N extends TranslationNamespace,
  T extends Record<string, TranslationValue>
>(namespace: N, translations: T): NamespaceKeyMap<N, T> {
  const entries = Object.keys(translations).map((key) => [key, `${namespace}.${key}`]);
  return Object.fromEntries(entries) as NamespaceKeyMap<N, T>;
}

export const I18N_KEYS = {
  shell: createNamespaceKeys('shell', TRANSLATIONS_BY_NAMESPACE.shell),
  listing: createNamespaceKeys('listing', TRANSLATIONS_BY_NAMESPACE.listing),
  auth: createNamespaceKeys('auth', TRANSLATIONS_BY_NAMESPACE.auth),
  property: createNamespaceKeys('property', TRANSLATIONS_BY_NAMESPACE.property),
  map: createNamespaceKeys('map', TRANSLATIONS_BY_NAMESPACE.map),
  maintenance: createNamespaceKeys('maintenance', TRANSLATIONS_BY_NAMESPACE.maintenance)
} as const;
