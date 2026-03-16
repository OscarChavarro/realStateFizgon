import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { UserPreferencesPayloadMapperService } from 'src/app/prefs/services/mappers/user-preferences-payload-mapper.service';

describe('UserPreferencesPayloadMapperService', () => {
  it('normalizePreferencesPayload should normalize payload values for frontend consumption', () => {
    // Arrange
    const mapper = new UserPreferencesPayloadMapperService();
    const payload = {
      language: ' SP ',
      pageSize: '500',
      showClosed: '0',
      showNew: 'yes',
      showFavourite: 0,
      showRejected: 1,
      minPublicationDate: '2026-03-01',
      maxPublicationDate: '2026-02-30',
      minPrice: '€ 1.400',
      maxPrice: 1500.4,
      sortCriteria: [
        { sortBy: 'title', sortOrder: 'desc' },
        { sortBy: 'title', sortOrder: 'asc' },
        { sortBy: 'publicationDate', order: 'desc' },
        { sortBy: 'price', sortOrder: 'invalid' },
        { sortBy: 'mainFeatures.area', sortOrder: 'asc' }
      ],
      propertyLabels: [
        { propertyId: ' p-2 ', labels: { review: ' favourite ', comment: '  hello  ', extra: true, propertyComments: 'legacy' } },
        { propertyId: 'p-3', labels: { review: 'invalid', propertyComments: '  from legacy  ' } }
      ]
    };

    // Action
    const result = mapper.normalizePreferencesPayload(payload);

    // Assert
    expect(result).toEqual({
      language: 'sp',
      pageSize: 500,
      filters: {
        showClosed: false,
        showNew: true,
        showFavourite: false,
        showRejected: true,
        minPublicationDate: '2026-03-01',
        maxPublicationDate: '',
        minPrice: '1400',
        maxPrice: '1500'
      },
      sortCriteria: [
        { sortBy: 'title', sortOrder: 'desc' },
        { sortBy: 'publicationDate', sortOrder: 'desc' },
        { sortBy: 'price', sortOrder: 'asc' }
      ],
      propertyLabels: [
        {
          propertyId: 'p-2',
          labels: { review: 'FAVOURITE', comment: 'hello', extra: true }
        },
        {
          propertyId: 'p-3',
          labels: { comment: 'from legacy' }
        }
      ]
    });
  });

  it('buildSaveFiltersPayload should normalize and sanitize payload before saving', () => {
    // Arrange
    const mapper = new UserPreferencesPayloadMapperService();
    const filters = createDefaultListingFilters();
    filters.showClosed = false;
    filters.showNew = false;
    filters.showFavourite = true;
    filters.showRejected = false;
    filters.minPublicationDate = ' 2026-03-10 ';
    filters.maxPublicationDate = '2026-13-10';
    filters.minPrice = '1400';
    filters.maxPrice = '€ 1600';

    // Action
    const result = mapper.buildSaveFiltersPayload(
      filters,
      'en',
      [
        { sortBy: 'title', sortOrder: 'desc' },
        { sortBy: 'title', sortOrder: 'asc' },
        { sortBy: 'publicationDate', sortOrder: 'asc' }
      ],
      999
    );

    // Assert
    expect(result).toEqual({
      language: 'en',
      showClosed: false,
      showNew: false,
      showFavourite: true,
      showRejected: false,
      pageSize: 100,
      minPublicationDate: '2026-03-10',
      maxPublicationDate: '',
      minPrice: '1400',
      maxPrice: '1600',
      sortCriteria: [
        { sortBy: 'title', sortOrder: 'desc' },
        { sortBy: 'publicationDate', sortOrder: 'asc' }
      ]
    });
  });

  [
    { value: true, fallback: false, expected: true, mapper: 'toBoolean' },
    { value: ' SP ', fallback: 'en', expected: 'sp', mapper: 'toSupportedLanguage' },
    { value: '2026-03-11', fallback: null, expected: '2026-03-11', mapper: 'toDateOnlyString' },
    { value: 'EUR 1.650', fallback: null, expected: '1650', mapper: 'toIntegerString' },
    { value: '1000', fallback: 100, expected: 1000, mapper: 'toPageSize' },
    { value: ' DESC ', fallback: 'asc', expected: 'desc', mapper: 'toSortDirection' }
  ].forEach(({ value, fallback, expected, mapper }) => {
    it(`${mapper} should normalize ${String(value)} as ${String(expected)}`, () => {
      // Arrange
      const payloadMapper = new UserPreferencesPayloadMapperService();

      // Action
      let result: unknown;
      if (mapper === 'toBoolean') {
        result = payloadMapper.toBoolean(value, fallback as boolean);
      } else if (mapper === 'toSupportedLanguage') {
        result = payloadMapper.toSupportedLanguage(value, fallback as 'en' | 'sp');
      } else if (mapper === 'toDateOnlyString') {
        result = payloadMapper.toDateOnlyString(value);
      } else if (mapper === 'toIntegerString') {
        result = payloadMapper.toIntegerString(value);
      } else if (mapper === 'toPageSize') {
        result = payloadMapper.toPageSize(value, fallback as number);
      } else {
        result = payloadMapper.toSortDirection(value, fallback as 'asc' | 'desc');
      }

      // Assert
      expect(result).toBe(expected);
    });
  });
});
