import { describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailDomExtractorService } from 'src/application/services/scraper/property/property-detail-dom-extractor.service';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';

import type { RuntimeClient } from 'src/application/services/scraper/property/runtime-client.type';
type ExtractedPropertyPayloadMock = {
  title: string | null;
  location: string | null;
  price: string | null;
  infoFeatures: string[];
  advertiserComment: string | null;
  featureGroups: Array<{ name: string; items: string[] }>;
  publicationAge: string | null;
  images: Array<{ url: string; title: string | null }>;
};

type PropertyDetailDomExtractorServicePrivate = {
  extractPropertyIdFromUrl(url: string): string | null;
  findAndRemoveFirst(values: string[], predicate: (value: string) => boolean): string | null;
  parsePriceToNumber(rawPrice: string | null): number | null;
};

function createRuntime(value: ExtractedPropertyPayloadMock | null): RuntimeClient {
  return {
    evaluate: jest.fn(async () => ({ result: { value } }))
  };
}

function createPayload(price: string | null, infoFeatures: string[]): ExtractedPropertyPayloadMock {
  return {
    title: 'Piso luminoso',
    location: 'Madrid',
    price,
    infoFeatures,
    advertiserComment: 'Comentario',
    featureGroups: [{ name: 'Equipamiento', items: ['Piscina'] }],
    publicationAge: 'actualizado hace 1 día',
    images: [
      { url: 'https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/a.jpg', title: 'blur' },
      { url: 'https://img4.idealista.com/not-blur/b.jpg', title: 'raw' },
      { url: 'not-a-valid-url', title: 'invalid' },
      { url: 'https://cdn.example.com/blur/x.jpg', title: 'external' }
    ]
  };
}

describe('PropertyDetailDomExtractorService', () => {
  it('whenRuntimeReturnsNull_extractProperty_shouldReturnNull', async () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const runtime = createRuntime(null);
    // Action
    const property = await service.extractProperty(runtime, 'https://www.idealista.com/inmueble/123/');
    // Assert
    expect(property).toBeNull();
    expect(runtime.evaluate).toHaveBeenCalledWith(expect.objectContaining({ returnByValue: true }));
  });

  it('whenRuntimeReturnsPayload_extractProperty_shouldMapPropertyWithParsedMainFeaturesAndPrice', async () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const payload = createPayload('1.250 EUR/mes', ['80 m² construidos', '3 hab.', 'Planta 2ª exterior', 'Con trastero']);
    const runtime = createRuntime(payload);
    // Action
    const property = await service.extractProperty(runtime, 'https://www.idealista.com/inmueble/987654/');
    // Assert
    expect(property?.propertyId).toBe('987654');
    expect(property?.price).toBe(1250);
    expect(property?.mainFeatures.area).toBe('80 m² construidos');
    expect(property?.mainFeatures.bedrooms).toBe('3 hab.');
    expect(property?.mainFeatures.buildingLocation).toBe('Planta 2ª exterior');
    expect(property?.mainFeatures.additionalNotes).toEqual(['Con trastero']);
  });

  it('whenUrlDoesNotContainPropertyId_extractProperty_shouldMapPropertyWithNullId', async () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const runtime = createRuntime(createPayload('950 EUR/mes', ['Garaje']));
    // Action
    const property = await service.extractProperty(runtime, 'https://www.idealista.com/alquiler-viviendas/madrid/');
    // Assert
    expect(property?.propertyId).toBeNull();
    expect(property?.mainFeatures.area).toBeNull();
    expect(property?.mainFeatures.bedrooms).toBeNull();
    expect(property?.mainFeatures.buildingLocation).toBeNull();
    expect(property?.mainFeatures.additionalNotes).toEqual(['Garaje']);
  });

  it('whenPriceHasNoDigits_extractProperty_shouldMapPropertyWithNullPrice', async () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const runtime = createRuntime(createPayload('precio a consultar', ['50 m²']));
    // Action
    const property = await service.extractProperty(runtime, 'https://www.idealista.com/inmueble/111/');
    // Assert
    expect(property?.price).toBeNull();
  });

  it('whenPriceAndUrlAreEmpty_extractProperty_shouldMapPropertyWithNullPriceAndNullPropertyId', async () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const payload = createPayload(null, ['50 m²']);
    const runtime = createRuntime(payload);
    // Action
    const property = await service.extractProperty(runtime, '   ');
    // Assert
    expect(property?.price).toBeNull();
    expect(property?.propertyId).toBeNull();
  });

  it.each([
    ['https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/a.jpg', true],
    ['https://img4.idealista.com/not-blur/b.jpg', false],
    ['https://cdn.example.com/blur/x.jpg', false],
    ['not-a-valid-url', false]
  ])('whenImageUrlIs%s_filterPropertyImagesByBlurPattern_shouldKeepExpectedUrls', (url, shouldKeep) => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const property = new Property(
      '123',
      'https://www.idealista.com/inmueble/123/',
      'Title',
      'Madrid',
      1000,
      new PropertyMainFeatures(null, null, null, []),
      'Comment',
      [],
      null,
      [{ url, title: null }]
    );
    // Action
    const filtered = service.filterPropertyImagesByBlurPattern(property);
    // Assert
    expect(filtered.images.length > 0).toBe(shouldKeep);
  });

  it('whenPropertyContainsMixedImages_filterPropertyImagesByBlurPattern_shouldKeepOnlyIdealistaBlurImages', () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const extracted = createPayload('1200', ['70 m²']);
    const property = new Property(
      '123',
      'https://www.idealista.com/inmueble/123/',
      extracted.title,
      extracted.location,
      1200,
      new PropertyMainFeatures(null, null, null, []),
      extracted.advertiserComment,
      [],
      extracted.publicationAge,
      extracted.images
    );
    // Action
    const filtered = service.filterPropertyImagesByBlurPattern(property);
    // Assert
    expect(filtered.images).toHaveLength(1);
    expect(filtered.images[0]?.url).toBe('https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/a.jpg');
  });

  it('whenRegexMatchGroupIsUndefined_extractPropertyIdFromUrl_shouldReturnNull', () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const privateService = service as unknown as PropertyDetailDomExtractorServicePrivate;
    const craftedUrl = {
      trim: () => ({
        match: () => ['matched-url-segment', undefined]
      })
    } as unknown as string;
    // Action
    const propertyId = privateService.extractPropertyIdFromUrl(craftedUrl);
    // Assert
    expect(propertyId).toBeNull();
  });

  it('whenFirstMatchedEntryIsSparse_findAndRemoveFirst_shouldReturnNullAndRemoveEntry', () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const privateService = service as unknown as PropertyDetailDomExtractorServicePrivate;
    const sparseValues: string[] = [];
    (sparseValues as unknown[]).length = 1;
    // Action
    const value = privateService.findAndRemoveFirst(sparseValues, () => true);
    // Assert
    expect(value).toBeNull();
    expect(sparseValues).toHaveLength(0);
  });

  it('whenPriceParsingOverflows_parsePriceToNumber_shouldReturnNull', () => {
    // Arrange
    const service = new PropertyDetailDomExtractorService();
    const privateService = service as unknown as PropertyDetailDomExtractorServicePrivate;
    const rawPrice = `EUR ${'9'.repeat(10000)}`;
    // Action
    const parsed = privateService.parsePriceToNumber(rawPrice);
    // Assert
    expect(parsed).toBeNull();
  });
});
