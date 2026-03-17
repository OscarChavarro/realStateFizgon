import { HttpErrorResponse } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { UserPreferencesService } from 'src/app/prefs/services/user-preferences.service';

class UserPreferencesServiceMockFactory {
  static createHttpClientMock() {
    return {
      get: jasmine.createSpy('get'),
      post: jasmine.createSpy('post')
    } as unknown as HttpClient;
  }
}

describe('UserPreferencesService', () => {
  it('loadPreferences should normalize payload values', async () => {
    // Arrange
    const service = new UserPreferencesService();
    const http = UserPreferencesServiceMockFactory.createHttpClientMock();
    (http.get as jasmine.Spy).and.returnValue(of({
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
        { sortBy: 'mainFeatures.area', sortOrder: 'asc' },
        { sortBy: 1, sortOrder: 'asc' },
        null
      ],
      propertyLabels: [
        'invalid',
        { propertyId: '  ', labels: {} },
        { propertyId: 'p-1', labels: null },
        { propertyId: ' p-2 ', labels: { review: ' favourite ', comment: '  hello  ', extra: true, propertyComments: 'legacy' } },
        { propertyId: 'p-3', labels: { review: 'invalid', propertyComments: '  from legacy  ' } },
        { propertyId: 'p-4', labels: { comment: 100 } }
      ]
    }));

    // Action
    const result = await service.loadPreferences(http);

    // Assert
    expect(http.get).toHaveBeenCalledOnceWith('/auth/preferences');
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
        },
        {
          propertyId: 'p-4',
          labels: {}
        }
      ]
    });
  });

  it('loadPreferences should return null on request error', async () => {
    // Arrange
    const service = new UserPreferencesService();
    const http = UserPreferencesServiceMockFactory.createHttpClientMock();
    (http.get as jasmine.Spy).and.returnValue(throwError(() => new Error('boom')));

    // Action
    const result = await service.loadPreferences(http);

    // Assert
    expect(result).toBeNull();
  });

  it('loadPreferences should retry transient errors before succeeding', async () => {
    // Arrange
    const service = new UserPreferencesService();
    const http = UserPreferencesServiceMockFactory.createHttpClientMock();
    (http.get as jasmine.Spy).and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 503, error: 'temporarily unavailable' })),
      of({
        language: 'en',
        pageSize: 100,
        showClosed: true,
        showNew: true,
        showFavourite: true,
        showRejected: true
      })
    );

    // Action
    const result = await service.loadPreferences(http);

    // Assert
    expect((http.get as jasmine.Spy).calls.count()).toBe(2);
    expect(result?.language).toBe('en');
  });

  it('saveFilters should post normalized filters payload', async () => {
    // Arrange
    const service = new UserPreferencesService();
    const http = UserPreferencesServiceMockFactory.createHttpClientMock();
    const filters = createDefaultListingFilters();
    filters.showClosed = false;
    filters.showNew = false;
    filters.showFavourite = true;
    filters.showRejected = false;
    filters.minPublicationDate = ' 2026-03-10 ';
    filters.maxPublicationDate = '2026-13-10';
    filters.minPrice = '1400';
    filters.maxPrice = '€ 1600';
    (http.post as jasmine.Spy).and.returnValue(of({}));

    // Action
    await service.saveFilters(
      http,
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
    expect(http.post).toHaveBeenCalledOnceWith('/auth/preferences', {
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

  it('setPropertyReview should post labels and normalize response', async () => {
    // Arrange
    const service = new UserPreferencesService();
    const http = UserPreferencesServiceMockFactory.createHttpClientMock();
    (http.post as jasmine.Spy).and.returnValue(of({
      propertyLabels: [
        { propertyId: 'p-1', labels: { review: 'discharged', propertyComments: '  saved  ' } }
      ]
    }));

    // Action
    const result = await service.setPropertyReview(http, 'p-1', 'FAVOURITE');

    // Assert
    expect(http.post).toHaveBeenCalledOnceWith('/auth/preferences/setPropertyLabels', {
      propertyId: 'p-1',
      labels: { review: 'FAVOURITE' }
    });
    expect(result).toEqual([
      {
        propertyId: 'p-1',
        labels: { review: 'DISCHARGED', comment: 'saved' }
      }
    ]);
  });

  it('setPropertyComment should post comment labels and normalize response', async () => {
    // Arrange
    const service = new UserPreferencesService();
    const http = UserPreferencesServiceMockFactory.createHttpClientMock();
    (http.post as jasmine.Spy).and.returnValue(of({
      propertyLabels: [{ propertyId: 'p-2', labels: { comment: ' kept ' } }]
    }));

    // Action
    const result = await service.setPropertyComment(http, 'p-2', 'message');

    // Assert
    expect(http.post).toHaveBeenCalledOnceWith('/auth/preferences/setPropertyLabels', {
      propertyId: 'p-2',
      labels: { comment: 'message' }
    });
    expect(result).toEqual([{ propertyId: 'p-2', labels: { comment: 'kept' } }]);
  });

  it('setPropertyComment should retry transient post failures before returning labels', async () => {
    // Arrange
    const service = new UserPreferencesService();
    const http = UserPreferencesServiceMockFactory.createHttpClientMock();
    (http.post as jasmine.Spy).and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 503, error: 'temporarily unavailable' })),
      of({
        propertyLabels: [{ propertyId: 'p-2', labels: { comment: 'kept' } }]
      })
    );

    // Action
    const result = await service.setPropertyComment(http, 'p-2', 'message');

    // Assert
    expect((http.post as jasmine.Spy).calls.count()).toBe(2);
    expect(result).toEqual([{ propertyId: 'p-2', labels: { comment: 'kept' } }]);
  });

  [
    { value: true, fallback: false, expected: true },
    { value: false, fallback: true, expected: false },
    { value: 1, fallback: false, expected: true },
    { value: 0, fallback: true, expected: false },
    { value: 'yes', fallback: false, expected: true },
    { value: 'TRUE', fallback: false, expected: true },
    { value: 'no', fallback: true, expected: false },
    { value: ' 0 ', fallback: true, expected: false },
    { value: 'maybe', fallback: true, expected: true },
    { value: null, fallback: false, expected: false }
  ].forEach(({ value, fallback, expected }) => {
    it(`toBoolean should map ${String(value)} to ${String(expected)}`, () => {
      // Arrange
      const service = new UserPreferencesService();

      // Action
      const result = (service as any).toBoolean(value, fallback);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: 'sp', fallback: 'en', expected: 'sp' },
    { value: ' EN ', fallback: 'sp', expected: 'en' },
    { value: 'fr', fallback: 'sp', expected: 'sp' },
    { value: 1, fallback: 'en', expected: 'en' }
  ].forEach(({ value, fallback, expected }) => {
    it(`toSupportedLanguage should map ${String(value)} to ${expected}`, () => {
      // Arrange
      const service = new UserPreferencesService();

      // Action
      const result = (service as any).toSupportedLanguage(value, fallback);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: undefined, expected: '' },
    { value: '   ', expected: '' },
    { value: 'invalid', expected: '' },
    { value: '2026-02-31', expected: '' },
    { value: '2026-03-11', expected: '2026-03-11' }
  ].forEach(({ value, expected }) => {
    it(`toDateOnlyString should map ${String(value)} to "${expected}"`, () => {
      // Arrange
      const service = new UserPreferencesService();

      // Action
      const result = (service as any).toDateOnlyString(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: 1500.9, expected: '1501' },
    { value: -1, expected: '' },
    { value: null, expected: '' },
    { value: 'EUR 1.650', expected: '1650' },
    { value: 'abc', expected: '' },
    { value: '9'.repeat(500), expected: '' }
  ].forEach(({ value, expected }) => {
    it(`toIntegerString should map ${String(value).slice(0, 20)} to "${expected}"`, () => {
      // Arrange
      const service = new UserPreferencesService();

      // Action
      const result = (service as any).toIntegerString(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: 500, fallback: 100, expected: 500 },
    { value: 111.7, fallback: 500, expected: 500 },
    { value: 999, fallback: 500, expected: 500 },
    { value: '1000', fallback: 100, expected: 1000 },
    { value: '12', fallback: 500, expected: 500 },
    { value: 'invalid', fallback: 500, expected: 500 },
    { value: undefined, fallback: 321, expected: 100 }
  ].forEach(({ value, fallback, expected }) => {
    it(`toPageSize should map value=${String(value)} and fallback=${fallback} to ${expected}`, () => {
      // Arrange
      const service = new UserPreferencesService();

      // Action
      const result = (service as any).toPageSize(value, fallback);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('normalizePropertyLabels should return empty array when value is not an array', () => {
    // Arrange
    const service = new UserPreferencesService();

    // Action
    const result = (service as any).normalizePropertyLabels({});

    // Assert
    expect(result).toEqual([]);
  });

  it('normalizeSortCriteria should normalize sort list and ignore invalid entries', () => {
    // Arrange
    const service = new UserPreferencesService();

    // Action
    const result = (service as any).normalizeSortCriteria([
      { sortBy: 'title', sortOrder: 'DESC' },
      { sortBy: 'title', sortOrder: 'asc' },
      { sortBy: 'publicationDate', order: 'desc' },
      { sortBy: 'price', sortOrder: 'unknown' },
      { sortBy: 'other', sortOrder: 'asc' },
      { sortBy: 100, sortOrder: 'asc' },
      'invalid'
    ]);

    // Assert
    expect(result).toEqual([
      { sortBy: 'title', sortOrder: 'desc' },
      { sortBy: 'publicationDate', sortOrder: 'desc' },
      { sortBy: 'price', sortOrder: 'asc' }
    ]);
  });

  it('normalizeSortCriteria should return empty array when value is not an array', () => {
    // Arrange
    const service = new UserPreferencesService();

    // Action
    const result = (service as any).normalizeSortCriteria(null);

    // Assert
    expect(result).toEqual([]);
  });

  [
    { value: 'asc', fallback: 'desc', expected: 'asc' },
    { value: ' DESC ', fallback: 'asc', expected: 'desc' },
    { value: 'invalid', fallback: 'desc', expected: 'desc' },
    { value: 1, fallback: 'asc', expected: 'asc' }
  ].forEach(({ value, fallback, expected }) => {
    it(`toSortDirection should map ${String(value)} to ${expected}`, () => {
      // Arrange
      const service = new UserPreferencesService();

      // Action
      const result = (service as any).toSortDirection(value, fallback);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
