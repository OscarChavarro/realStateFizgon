import { I18nService } from 'src/app/core/i18n/services/i18n.service';
import { I18N_KEYS } from 'src/app/core/i18n/translations/i18n-keys.const';
import { SupportedLanguage } from 'src/app/core/i18n/types/supported-language.type';
import { TranslationKey } from 'src/app/core/i18n/translations/translations-by-namespace.const';

function flattenTranslationKeys(): TranslationKey[] {
  const namespaces = Object.values(I18N_KEYS) as ReadonlyArray<Record<string, TranslationKey>>;
  return namespaces.flatMap((namespaceEntries) =>
    Object.values(namespaceEntries)
  ) as TranslationKey[];
}

describe('I18nService', () => {
  let service: I18nService;

  const languages: SupportedLanguage[] = ['en', 'sp'];
  const allKeys = flattenTranslationKeys();

  const explicitCases: ReadonlyArray<{ key: TranslationKey; en: string; sp: string }> = [
    { key: I18N_KEYS.shell.DASHBOARD, en: 'Listing', sp: 'Listado' },
    { key: I18N_KEYS.listing.REVIEW_DISCHARGED, en: 'Rejected', sp: 'Rechazado' },
    { key: I18N_KEYS.listing.PUBLICATION_DATE, en: 'Published on', sp: 'Publicado en' }
  ];

  beforeEach(() => {
    service = new I18nService();
  });

  explicitCases.forEach(({ key, en, sp }) => {
    it(`whenExplicitKey_${key}_get_shouldReturnExpectedTranslations`, () => {
      expect(service.get(key, 'en')).toBe(en);
      expect(service.get(key, 'sp')).toBe(sp);
    });
  });

  allKeys.forEach((key) => {
    languages.forEach((language) => {
      it(`whenValidKey_${key}_andLanguage_${language}_get_shouldReturnNonEmptyTranslation`, () => {
        const translation = service.get(key, language);
        expect(typeof translation).toBe('string');
        expect(translation.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('whenInvalidKey_get_shouldThrowTypeError', () => {
    expect(() => service.get('invalid.UNKNOWN' as TranslationKey, 'en')).toThrow();
  });

  it('whenKeyIsMissingInValidNamespace_get_shouldThrowMissingTranslationError', () => {
    const missingKey = 'shell.UNKNOWN_KEY' as TranslationKey;
    expect(() => service.get(missingKey, 'en')).toThrowError(
      `[I18nService] Missing translation for key "${missingKey}".`
    );
  });
});
