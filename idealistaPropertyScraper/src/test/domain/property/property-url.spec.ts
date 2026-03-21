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
});
