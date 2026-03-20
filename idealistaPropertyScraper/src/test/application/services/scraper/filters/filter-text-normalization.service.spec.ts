import { describe, expect, it } from '@jest/globals';
import { FilterTextNormalizationService } from 'application/services/scraper/filters/filter-text-normalization.service';

describe('FilterTextNormalizationService', () => {
  it.each([
    { value: '  Desplegar  Ático  ', expected: 'atico' },
    { value: 'Piso   céntrico', expected: 'piso centrico' },
    { value: 'DESPLEGAR  Dúplex', expected: 'duplex' }
  ])('whenValueNeedsNormalization_normalizeComparableText_shouldReturnNormalizedValue', ({ value, expected }) => {
    // Arrange
    const service = new FilterTextNormalizationService();
    // Action
    const result = service.normalizeComparableText(value);
    // Assert
    expect(result).toBe(expected);
  });
});
