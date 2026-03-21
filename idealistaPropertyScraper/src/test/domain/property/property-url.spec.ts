import { describe, expect, it } from '@jest/globals';
import { PropertyUrl } from 'domain/property/property-url';

describe('PropertyUrl', () => {
  it('whenAbsolutePropertyUrlIsNormalized_normalize_shouldReturnCanonicalUrl', () => {
    // Arrange
    const rawUrl = 'https://www.idealista.com/inmueble/123456789/?foo=bar#section';
    // Action
    const normalized = PropertyUrl.normalize(rawUrl);
    // Assert
    expect(normalized).toBe('https://www.idealista.com/inmueble/123456789/');
  });

  it('whenRelativePropertyUrlIsNormalizedWithBase_normalize_shouldReturnCanonicalAbsoluteUrl', () => {
    // Arrange
    const rawUrl = '/inmueble/987654321';
    // Action
    const normalized = PropertyUrl.normalize(rawUrl, 'https://www.idealista.com');
    // Assert
    expect(normalized).toBe('https://www.idealista.com/inmueble/987654321/');
  });

  it.each([
    '',
    '   ',
    'https://www.idealista.com/alquiler-viviendas/madrid/',
    'not-a-url'
  ])('whenUrlCannotBeNormalized_normalize_shouldReturnNull (%s)', (rawUrl) => {
    // Action
    const normalized = PropertyUrl.normalize(rawUrl);
    // Assert
    expect(normalized).toBeNull();
  });

  it.each([
    ['https://www.idealista.com/inmueble/123456789/', '123456789'],
    ['https://www.idealista.com/inmueble/123456789', '123456789'],
    ['/inmueble/123456789/', '123456789'],
    ['prefix /inmueble/123456789/ suffix', '123456789']
  ])('whenPropertyIdExists_extractPropertyId_shouldReturnIt (%s)', (rawUrl, expectedPropertyId) => {
    // Action
    const propertyId = PropertyUrl.extractPropertyId(rawUrl);
    // Assert
    expect(propertyId).toBe(expectedPropertyId);
  });

  it('whenValueIsNotAString_extractPropertyId_shouldReturnNull', () => {
    // Arrange
    const invalidInput = { url: '/inmueble/1/' } as unknown as string;
    // Action
    const propertyId = PropertyUrl.extractPropertyId(invalidInput);
    // Assert
    expect(propertyId).toBeNull();
  });

  it('whenAbsoluteUrlIsValid_create_shouldBuildValueObjectWithCanonicalUrlAndOptionalPropertyId', () => {
    // Arrange
    const propertyUrl = PropertyUrl.create('https://www.idealista.com/inmueble/123/?x=1');
    const listingUrl = PropertyUrl.create('https://www.idealista.com/alquiler-viviendas/madrid/');
    // Assert
    expect(propertyUrl.value).toBe('https://www.idealista.com/inmueble/123/');
    expect(propertyUrl.propertyId?.value).toBe('123');
    expect(listingUrl.value).toBe('https://www.idealista.com/alquiler-viviendas/madrid/');
    expect(listingUrl.propertyId).toBeNull();
  });

  it('whenUrlIsInvalid_create_shouldThrowAndTryCreateShouldReturnNull', () => {
    // Action
    const createAction = (): PropertyUrl => PropertyUrl.create('not-a-url');
    const tryCreateResult = PropertyUrl.tryCreate('not-a-url');
    // Assert
    expect(createAction).toThrow('valid URL');
    expect(tryCreateResult).toBeNull();
  });

  it('whenUrlUsesUnsupportedProtocol_create_shouldThrowError', () => {
    // Action
    const action = (): PropertyUrl => PropertyUrl.create('ftp://www.idealista.com/inmueble/123/');
    // Assert
    expect(action).toThrow('http or https');
  });

  it('whenUrlsAreCompared_equalsAndToString_shouldUseNormalizedValue', () => {
    // Arrange
    const left = PropertyUrl.create('https://www.idealista.com/inmueble/123/?a=1');
    const right = PropertyUrl.create('https://www.idealista.com/inmueble/123/');
    // Assert
    expect(left.equals(right)).toBe(true);
    expect(left.toString()).toBe('https://www.idealista.com/inmueble/123/');
  });
});
