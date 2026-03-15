import { I18nService, SupportedLanguage, TranslationKey } from 'src/app/core/i18n/services/i18n.service';

describe('I18nService', () => {
  let service: I18nService;

  const languages: SupportedLanguage[] = ['en', 'sp'];
  const allKeys: readonly TranslationKey[] = [
    'DASHBOARD',
    'DATABASE_MAINTENANCE_TAB',
    'USERS_TAB',
    'LANGUAGE_EN',
    'LANGUAGE_SP',
    'FILTERS',
    'SHOW_CLOSED_PROPERTIES',
    'SHOW_REVIEW_NEW',
    'SHOW_REVIEW_FAVOURITE',
    'SHOW_REVIEW_REJECTED',
    'MIN_PUBLICATION_DATE',
    'MAX_PUBLICATION_DATE',
    'PRICE_RANGE',
    'MIN_PRICE',
    'MAX_PRICE',
    'LOADING_PRICE_RANGE',
    'PRICE_RANGE_NOT_AVAILABLE',
    'SHOWING_PROPERTIES',
    'FULLSCREEN',
    'CYCLE_LAYOUT',
    'USER_MENU',
    'LOGIN_WITH_GOOGLE',
    'GOOGLE_LOGIN_NOT_CONFIGURED',
    'SIGNED_IN_USER',
    'LOGOUT',
    'USER_ROLE',
    'USER_NAME',
    'USER_EMAIL',
    'USER_PERMISSIONS',
    'USER_LAST_LOGIN',
    'ACTIONS',
    'DELETE_USER',
    'DELETE_USER_CURRENT_DISABLED',
    'LOADING_USERS',
    'NO_USERS_FOUND',
    'PUBLICATION_DATE',
    'TITLE',
    'PRICE',
    'REVIEW_COLUMN',
    'REVIEW_NEW',
    'REVIEW_FAVOURITE',
    'REVIEW_DISCHARGED',
    'COMMENT',
    'COMMENT_PLACEHOLDER',
    'LOCATION',
    'PROPERTY_DETAIL_SOURCE',
    'DESCRIPTION',
    'SORT_ASC',
    'SORT_DESC',
    'SORT_DISABLED',
    'NO_PROPERTIES_FOUND',
    'REMOVE_DANGLING_IMAGES',
    'OPERATION_RESULT'
  ];

  const explicitCases: ReadonlyArray<{ key: TranslationKey; en: string; sp: string }> = [
    { key: 'DASHBOARD', en: 'Listing', sp: 'Listado' },
    { key: 'REVIEW_DISCHARGED', en: 'Rejected', sp: 'Rechazado' },
    { key: 'PUBLICATION_DATE', en: 'Published on', sp: 'Publicado en' }
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
    expect(() => service.get('NOT_A_REAL_KEY' as TranslationKey, 'en')).toThrow();
  });
});
