import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { ListingDataService } from 'src/app/listing/services/listing-data.service';

class ListingDataHttpMock {
  readonly getCalls: string[] = [];
  private responses: any[] = [];

  queueResponse(response: unknown): void {
    this.responses.push(of(response));
  }

  queueError(error: unknown): void {
    this.responses.push(throwError(() => error));
  }

  get<T>(url: string) {
    this.getCalls.push(url);
    const next = this.responses.shift();
    if (!next) {
      return throwError(() => new Error('missing-mock-response')) as any;
    }
    return next as any;
  }
}

describe('ListingDataService', () => {
  let service: ListingDataService;
  let httpMock: ListingDataHttpMock;

  beforeEach(() => {
    service = new ListingDataService();
    httpMock = new ListingDataHttpMock();
  });

  it('loadBackendConfiguration should normalize configured values', async () => {
    // Arrange
    httpMock.queueResponse({
      staticMedia: ' http://cdn.example.com/media ',
      backend: { baseUrl: ' http://localhost:8081/ ' },
      google: { maps: { 'api-key': ' api-key ', 'map-id': ' map-id ' } }
    });

    // Action
    const result = await service.loadBackendConfiguration(httpMock as any);

    // Assert
    expect(result).toEqual({
      backendBaseUrl: 'http://localhost:8081',
      staticMediaBaseUrl: 'http://cdn.example.com/media/',
      googleMapsApiKey: 'api-key',
      googleMapsMapId: 'map-id'
    });
  });

  it('loadBackendConfiguration should fallback to defaults on request error', async () => {
    // Arrange
    httpMock.queueError(new Error('network'));

    // Action
    const result = await service.loadBackendConfiguration(httpMock as any);

    // Assert
    expect(result.backendBaseUrl).toBe('http://192.168.1.110:4200');
    expect(result.staticMediaBaseUrl).toBe('http://localhost:666/');
    expect(result.googleMapsApiKey).toBeNull();
    expect(result.googleMapsMapId).toBeNull();
  });

  it('loadBackendConfiguration should keep defaults when optional values are empty in payload', async () => {
    // Arrange
    httpMock.queueResponse({
      staticMedia: '   ',
      backend: { baseUrl: '   ' },
      google: { maps: { 'api-key': '   ', 'map-id': 10 } }
    });

    // Action
    const result = await service.loadBackendConfiguration(httpMock as any);

    // Assert
    expect(result.backendBaseUrl).toBe('http://192.168.1.110:4200');
    expect(result.staticMediaBaseUrl).toBe('http://localhost:666/');
    expect(result.googleMapsApiKey).toBeNull();
    expect(result.googleMapsMapId).toBeNull();
  });

  it('loadListingData should map rows and pagination on first request success', async () => {
    // Arrange
    const filters = createDefaultListingFilters();
    httpMock.queueResponse({
      error: null,
      data: [
        {
          publicationDate: '2026-03-15T10:00:00.000Z',
          closedBy: 'done',
          propertyId: 10,
          title: '  Main title  ',
          location: '  Madrid  ',
          description: 'description',
          advertiserComment: '',
          url: ' https://example.com/p/10 ',
          price: 1800,
          images: [{ localUrl: ' /img/a.jpg ' }, 'invalid'],
          geoLocationHint: { lat: '40.5', lon: '-3.6' }
        }
      ],
      pagination: {
        page: 2,
        pageSize: 100,
        totalElements: 101
      }
    });
    httpMock.queueResponse({ count: 227 });

    // Action
    const result = await service.loadListingData(httpMock as any, [], filters, 2, 100);

    // Assert
    expect(result.count).toBe(227);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 100,
      totalElements: 101,
      totalPages: 2
    });
    expect(result.properties[0]).toEqual({
      propertyId: '10',
      publicationDate: '2026-03-15T10:00:00.000Z',
      publicationDateShort: '2026-03-15',
      title: 'Main title',
      url: 'https://example.com/p/10',
      price: '1800',
      location: 'Madrid',
      advertiserComment: 'description',
      localImageUrls: ['/img/a.jpg'],
      unavailable: true,
      geoLocationHint: { lat: 40.5, lon: -3.6 }
    });
  });

  it('loadListingData should retry using page size limit extracted from error', async () => {
    // Arrange
    const filters = createDefaultListingFilters();
    httpMock.queueError(new HttpErrorResponse({
      status: 400,
      error: 'pageSize cannot be greater than total properties (7)'
    }));
    httpMock.queueResponse({
      error: null,
      data: [],
      pagination: { page: 1, pageSize: 7, totalElements: 0 }
    });
    httpMock.queueResponse({ count: 20 });

    // Action
    const result = await service.loadListingData(httpMock as any, [], filters, 3, 500);

    // Assert
    expect(httpMock.getCalls[0]).toContain('pageSize=500');
    expect(httpMock.getCalls[1]).toContain('pageSize=7');
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('loadListingData should fallback to page=1&pageSize=1 when no limit can be extracted', async () => {
    // Arrange
    const filters = createDefaultListingFilters();
    httpMock.queueError(new Error('unknown failure'));
    httpMock.queueResponse({
      error: null,
      data: [],
      pagination: { page: -1, pageSize: 1, totalElements: 2 }
    });
    httpMock.queueError(new Error('count-failed'));

    // Action
    const result = await service.loadListingData(httpMock as any, [], filters, 4, 1200);

    // Assert
    expect(httpMock.getCalls[1]).toContain('page=1');
    expect(httpMock.getCalls[1]).toContain('pageSize=1');
    expect(result.count).toBe(2);
    expect(result.pagination.page).toBe(1);
  });

  it('loadListingData should fallback to data length when totalElements is undefined', async () => {
    // Arrange
    const filters = createDefaultListingFilters();
    httpMock.queueResponse({
      error: null,
      data: [{ propertyId: '1', title: 'One', url: 'https://example.com/1' }],
      pagination: { page: 1, pageSize: 100, totalElements: undefined }
    });
    httpMock.queueError(new Error('count-failed'));

    // Action
    const result = await service.loadListingData(httpMock as any, [], filters, 1, 100);

    // Assert
    expect(result.count).toBe(1);
    expect(result.pagination.totalElements).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('loadListingData should return empty result when requests keep failing', async () => {
    // Arrange
    const filters = createDefaultListingFilters();
    httpMock.queueError(new Error('first'));
    httpMock.queueError(new Error('second'));
    httpMock.queueError(new Error('count'));

    // Action
    const result = await service.loadListingData(httpMock as any, [], filters, 0, 0);

    // Assert
    expect(result).toEqual({
      count: 0,
      properties: [],
      pagination: {
        page: 1,
        pageSize: 100,
        totalElements: 0,
        totalPages: 0
      }
    });
  });

  [
    {
      error: new HttpErrorResponse({ status: 400, error: { error: 'pageSize cannot be greater than total properties (9)' } }),
      expected: 9
    },
    {
      error: new HttpErrorResponse({ status: 400, error: { message: 'pageSize cannot be greater than total properties (0)' } }),
      expected: 1
    },
    (() => {
      const error = new HttpErrorResponse({ status: 400, error: {} });
      Object.defineProperty(error, 'message', {
        configurable: true,
        value: 'pageSize cannot be greater than total properties (5)'
      });
      return { error, expected: 5 };
    })(),
    {
      error: new Error('x'),
      expected: null
    }
  ].forEach(({ error, expected }) => {
    it(`extractMaxAllowedPageSize should return ${String(expected)}`, () => {
      // Arrange

      // Action
      const result = (service as any).extractMaxAllowedPageSize(error);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('extractMaxAllowedPageSize should return null when candidates do not match the expected pattern', () => {
    // Arrange
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        error: 'unexpected payload'
      }
    });
    Object.defineProperty(error, 'message', {
      configurable: true,
      value: 'another unexpected message'
    });

    // Action
    const result = (service as any).extractMaxAllowedPageSize(error);

    // Assert
    expect(result).toBeNull();
  });

  it('buildPropertiesEndpointUrl should include all filters, sort and pagination params', () => {
    // Arrange
    const filters = {
      ...createDefaultListingFilters(),
      minPublicationDate: ' 2026-02-01 ',
      maxPublicationDate: ' 2026-03-01 ',
      minPrice: ' 1200 ',
      maxPrice: ' 1800 '
    };
    const sortCriteria = [
      { sortBy: 'title', sortOrder: 'asc' },
      { sortBy: 'price', sortOrder: 'desc' }
    ];

    // Action
    const withPagination = (service as any).buildPropertiesEndpointUrl(sortCriteria, filters, 3, 500, true) as string;
    const withoutPagination = (service as any).buildPropertiesEndpointUrl([], filters, 1, 100, false) as string;

    // Assert
    expect(withPagination).toContain('/properties?');
    expect(withPagination).toContain('page=3');
    expect(withPagination).toContain('pageSize=500');
    expect(withPagination).toContain('minPublicationDate=2026-02-01');
    expect(withPagination).toContain('maxPublicationDate=2026-03-01');
    expect(withPagination).toContain('minPrice=1200');
    expect(withPagination).toContain('maxPrice=1800');
    expect(withPagination).toContain('sortOrder=asc');
    expect(withPagination).toContain('sortBy=title');
    expect(withPagination).toContain('sortOrder=desc');
    expect(withPagination).toContain('sortBy=price');
    expect(withoutPagination).not.toContain('page=');
    expect(withoutPagination).not.toContain('pageSize=');
  });

  it('buildPropertiesEndpointUrl should include false values for review and closed filters', () => {
    // Arrange
    const filters = {
      ...createDefaultListingFilters(),
      showClosed: false,
      showNew: false,
      showFavourite: false,
      showRejected: false
    };

    // Action
    const endpoint = (service as any).buildPropertiesEndpointUrl([], filters, 1, 100, true) as string;

    // Assert
    expect(endpoint).toContain('showClosed=false');
    expect(endpoint).toContain('showNew=false');
    expect(endpoint).toContain('showFavourite=false');
    expect(endpoint).toContain('showRejected=false');
  });

  [
    { input: 'http://backend.local/', expected: 'http://backend.local' },
    { input: 'http://backend.local', expected: 'http://backend.local' }
  ].forEach(({ input, expected }) => {
    it(`normalizeBackendBaseUrl should map "${input}"`, () => {
      // Arrange

      // Action
      const result = (service as any).normalizeBackendBaseUrl(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { input: 'http://cdn.local/', expected: 'http://cdn.local/' },
    { input: 'http://cdn.local', expected: 'http://cdn.local/' }
  ].forEach(({ input, expected }) => {
    it(`normalizeStaticMediaBaseUrl should map "${input}"`, () => {
      // Arrange

      // Action
      const result = (service as any).normalizeStaticMediaBaseUrl(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: ' api ', expected: 'api' },
    { value: '   ', expected: null },
    { value: 10, expected: null }
  ].forEach(({ value, expected }) => {
    it(`normalizeGoogleMapsApiKey should map ${String(value)}`, () => {
      // Arrange

      // Action
      const result = (service as any).normalizeGoogleMapsApiKey(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: ' map ', expected: 'map' },
    { value: '   ', expected: null },
    { value: {}, expected: null }
  ].forEach(({ value, expected }) => {
    it(`normalizeGoogleMapsMapId should map ${String(value)}`, () => {
      // Arrange

      // Action
      const result = (service as any).normalizeGoogleMapsMapId(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: '2026-03-14', expected: '2026-03-14' },
    { value: 'invalid-date', expected: '' },
    { value: '   ', expected: '' }
  ].forEach(({ value, expected }) => {
    it(`toDateOnlyString should map "${value}"`, () => {
      // Arrange

      // Action
      const result = (service as any).toDateOnlyString(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('toFiniteNumber should return null for object values without numeric primitives', () => {
    // Arrange

    // Action
    const result = (service as any).toFiniteNumber({});

    // Assert
    expect(result).toBeNull();
  });

  it('toDateOnlyString should parse non-ISO strings as local date when valid', () => {
    // Arrange

    // Action
    const result = (service as any).toDateOnlyString('March 1, 2026');

    // Assert
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('toDateOnlyString should map Date and unknown values', () => {
    // Arrange
    const date = new Date('2026-04-05T10:00:00.000Z');

    // Action
    const dateResult = (service as any).toDateOnlyString(date);
    const unknownResult = (service as any).toDateOnlyString(10);

    // Assert
    expect(dateResult).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(unknownResult).toBe('');
  });

  [
    { value: '2026-03-15T10:00:00.000Z', expected: '2026-03-15T10:00:00.000Z' },
    { value: 'raw-value', expected: 'raw-value' },
    { value: '   ', expected: '' }
  ].forEach(({ value, expected }) => {
    it(`toDateTimeString should map "${value}"`, () => {
      // Arrange

      // Action
      const result = (service as any).toDateTimeString(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('toDateTimeString should map Date and unknown values', () => {
    // Arrange
    const date = new Date('2026-03-15T10:00:00.000Z');

    // Action
    const dateResult = (service as any).toDateTimeString(date);
    const unknownResult = (service as any).toDateTimeString(15);

    // Assert
    expect(dateResult).toBe('2026-03-15T10:00:00.000Z');
    expect(unknownResult).toBe('');
  });

  it('extractLocalImageUrls should keep only non-empty trimmed local URLs', () => {
    // Arrange
    const images = [{ localUrl: ' /a.jpg ' }, { localUrl: ' ' }, 'x', null];

    // Action
    const result = (service as any).extractLocalImageUrls(images);
    const empty = (service as any).extractLocalImageUrls(null);

    // Assert
    expect(result).toEqual(['/a.jpg']);
    expect(empty).toEqual([]);
  });

  it('parseGeoLocationHint should parse valid coordinates and reject invalid values', () => {
    // Arrange

    // Action
    const valid = (service as any).parseGeoLocationHint({ latitude: '40.1', longitude: '-3.7' });
    const invalid = (service as any).parseGeoLocationHint({ lat: 'x', lon: 1 });
    const missing = (service as any).parseGeoLocationHint(null);

    // Assert
    expect(valid).toEqual({ lat: 40.1, lon: -3.7 });
    expect(invalid).toBeNull();
    expect(missing).toBeNull();
  });

  [
    { value: 10, expected: 10 },
    { value: Number.POSITIVE_INFINITY, expected: null },
    { value: ' 3.14 ', expected: 3.14 },
    { value: '', expected: null },
    { value: { $numberDecimal: '4.2' }, expected: 4.2 },
    { value: { $numberDecimal: 'x' }, expected: null },
    { value: { valueOf: () => 7 }, expected: 7 },
    { value: { valueOf: () => '8.5' }, expected: 8.5 },
    { value: { valueOf: () => 'x' }, expected: null }
  ].forEach(({ value, expected }) => {
    it(`toFiniteNumber should return ${String(expected)} for value`, () => {
      // Arrange

      // Action
      const result = (service as any).toFiniteNumber(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { value: null, expected: false },
    { value: undefined, expected: false },
    { value: ' ', expected: false },
    { value: 'done', expected: true },
    { value: new Date('invalid'), expected: false },
    { value: new Date('2026-01-01T00:00:00.000Z'), expected: true },
    { value: 1, expected: true }
  ].forEach(({ value, expected }) => {
    it(`hasClosedByValue should return ${expected}`, () => {
      // Arrange

      // Action
      const result = (service as any).hasClosedByValue(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { closedBy: null, isClosed: null, closedByExists: true, expected: true },
    { closedBy: null, isClosed: null, closedByExists: 'yes', expected: true },
    { closedBy: null, isClosed: null, closedByExists: 1, expected: true },
    { closedBy: null, isClosed: true, closedByExists: false, expected: true },
    { closedBy: null, isClosed: false, closedByExists: false, expected: false },
    { closedBy: null, isClosed: '1', closedByExists: false, expected: true },
    { closedBy: null, isClosed: '0', closedByExists: false, expected: false },
    { closedBy: null, isClosed: 2, closedByExists: false, expected: true },
    { closedBy: 'x', isClosed: 'unknown', closedByExists: false, expected: true },
    { closedBy: '', isClosed: 'unknown', closedByExists: false, expected: false }
  ].forEach(({ closedBy, isClosed, closedByExists, expected }) => {
    it(`isUnavailable should return ${expected}`, () => {
      // Arrange

      // Action
      const result = (service as any).isUnavailable(closedBy, isClosed, closedByExists);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('mapPropertiesForListing should cover fallback and payload variants', () => {
    // Arrange
    const mapped = (service as any).mapPropertiesForListing([
      {
        publicationDate: new Date('2026-03-11T00:00:00.000Z'),
        closedby: null,
        closedByExists: true,
        propertyId: null,
        title: '   ',
        location: '',
        description: 'desc',
        advertiserComment: '  ad  ',
        url: ' ',
        price: null,
        images: [{ localUrl: ' /x.jpg ' }, { localUrl: null }],
        geoLocationHint: { lat: '40.1', lon: '-3.5' }
      },
      {
        publicationDate: 'invalid',
        closed_by: '2026',
        isClosed: 'false',
        propertyId: '12',
        title: 'Title 12',
        location: 'Loc',
        description: '',
        advertiserComment: '',
        url: 'https://example.com/12',
        price: '1800',
        images: [],
        geoLocationHint: { lat: 'x', lon: 'y' }
      }
    ]);

    // Action

    // Assert
    expect(mapped[0].propertyId).toBe('');
    expect(mapped[0].title).toBe('-');
    expect(mapped[0].advertiserComment).toBe('ad');
    expect(mapped[0].price).toBe('-');
    expect(mapped[0].localImageUrls).toEqual(['/x.jpg']);
    expect(mapped[0].geoLocationHint).toEqual({ lat: 40.1, lon: -3.5 });
    expect(mapped[0].unavailable).toBeTrue();
    expect(mapped[1].publicationDate).toBe('invalid');
    expect(mapped[1].geoLocationHint).toBeNull();
    expect(mapped[1].unavailable).toBeTrue();
  });

  it('mapPropertiesForListing should use payload fallback values when fields are malformed', () => {
    // Arrange
    const mapped = (service as any).mapPropertiesForListing([
      {
        publicationDate: '2026-03-14',
        closedByExists: undefined,
        isClosed: undefined,
        propertyId: 90,
        title: 'Row',
        location: 'Madrid',
        description: 45,
        advertiserComment: '   ',
        url: 15,
        price: 1500,
        images: [],
        geoLocationHint: { lat: '40.2', lon: '-3.8' }
      }
    ]);

    // Action
    const row = mapped[0];

    // Assert
    expect(row.url).toBe('');
    expect(row.advertiserComment).toBe('');
    expect(row.unavailable).toBeTrue();
  });

  it('mapPropertiesForListing should map mainFeatures area and bedrooms when present', () => {
    // Arrange
    const mapped = (service as any).mapPropertiesForListing([
      {
        publicationDate: '2026-03-14',
        propertyId: '101',
        title: 'Feature row',
        location: 'Madrid',
        advertiserComment: '',
        description: '',
        url: 'https://example.com/101',
        price: 1700,
        mainFeatures: {
          area: ' 82 m² ',
          bedrooms: 3
        },
        images: [],
        geoLocationHint: { lat: '40.2', lon: '-3.8' }
      }
    ]);

    // Action
    const row = mapped[0];

    // Assert
    expect(row.area).toBe('82 m²');
    expect(row.bedrooms).toBe('3');
  });

  [
    { input: ' 90 m² ', expected: '90 m²' },
    { input: 2, expected: '2' },
    { input: Number.POSITIVE_INFINITY, expected: '' },
    { input: null, expected: '' }
  ].forEach(({ input, expected }) => {
    it(`normalizeMainFeatureValue should map ${String(input)} to "${expected}"`, () => {
      // Arrange

      // Action
      const result = (service as any).normalizeMainFeatureValue(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
