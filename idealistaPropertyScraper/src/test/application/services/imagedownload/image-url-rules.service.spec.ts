import { describe, expect, it } from '@jest/globals';
import { ImageUrlRulesService } from 'src/application/services/imagedownload/image-url-rules.service';

describe('ImageUrlRulesService', () => {
  it.each([
    { url: 'https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/a/b/c/file.jpg', expected: true },
    { url: 'https://img4.idealista.com/WEB_DETAIL/0/id.pro.es.image.master/a/b/c/file.jpg', expected: false },
    { url: 'https://img4.idealista.com/blur/loading.gif', expected: false },
    { url: 'https://example.com/blur/WEB_DETAIL/file.jpg', expected: false },
    { url: 'not-a-url', expected: false }
  ])('whenImageTrackingIsEvaluated_shouldTrackImageUrl_shouldReturnExpectedResult', ({ url, expected }) => {
    // Arrange
    const service = new ImageUrlRulesService();
    // Action
    const result = service.shouldTrackImageUrl(url);
    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    { url: 'https://idealista.com/path', expected: true },
    { url: 'https://img4.idealista.com/path', expected: true },
    { url: 'https://example.com/path', expected: false },
    { url: 'invalid', expected: false }
  ])('whenDomainIsEvaluated_isIdealistaDomain_shouldReturnExpectedResult', ({ url, expected }) => {
    // Arrange
    const service = new ImageUrlRulesService();
    // Action
    const result = service.isIdealistaDomain(url);
    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    { url: 'https://img4.idealista.com/image.svg', mimeType: 'image/svg+xml', expected: true },
    { url: 'https://img4.idealista.com/image.svg', mimeType: 'image/jpeg', expected: true },
    { url: 'https://img4.idealista.com/image.jpg', mimeType: 'image/jpeg', expected: false }
  ])('whenSvgCheckRuns_isSvgImage_shouldReturnExpectedResult', ({ url, mimeType, expected }) => {
    // Arrange
    const service = new ImageUrlRulesService();
    // Action
    const result = service.isSvgImage(url, mimeType);
    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    { url: 'https://img4.idealista.com/a/b/c/file.jpg?x=1', expected: '/a/b/c/file.jpg' },
    { url: 'invalid', expected: '' }
  ])('whenSafePathnameIsRequested_safeUrlPathname_shouldReturnExpectedValue', ({ url, expected }) => {
    // Arrange
    const service = new ImageUrlRulesService();
    // Action
    const result = service.safeUrlPathname(url);
    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    { url: 'https://www.idealista.com/inmueble/123456789/', expected: '123456789' },
    { url: 'https://www.idealista.com/sin-id/', expected: null }
  ])('whenPropertyIdIsExtracted_extractPropertyIdFromUrl_shouldReturnExpectedValue', ({ url, expected }) => {
    // Arrange
    const service = new ImageUrlRulesService();
    // Action
    const result = service.extractPropertyIdFromUrl(url);
    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    {
      url: 'https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/ba/03/bc/1388548264.jpg',
      expected: 'ba/03/bc/1388548264'
    },
    {
      url: 'https://img4.idealista.com/image.jpg',
      expected: 'image'
    },
    {
      url: 'invalid-url',
      expected: null
    },
    {
      url: 'https://img4.idealista.com/',
      expected: null
    },
    {
      url: 'https://img4.idealista.com/a/.jpg',
      expected: null
    }
  ])('whenCanonicalImageKeyIsExtracted_extractCanonicalImageKey_shouldReturnExpectedValue', ({ url, expected }) => {
    // Arrange
    const service = new ImageUrlRulesService();
    // Action
    const result = service.extractCanonicalImageKey(url);
    // Assert
    expect(result).toBe(expected);
  });

  it('whenBlurPathCheckReceivesInvalidUrl_isBlurImageUrl_shouldReturnFalse', () => {
    // Arrange
    const service = new ImageUrlRulesService();
    // Action
    const result = (service as unknown as { isBlurImageUrl: (url: string) => boolean }).isBlurImageUrl('invalid-url');
    // Assert
    expect(result).toBe(false);
  });
});
