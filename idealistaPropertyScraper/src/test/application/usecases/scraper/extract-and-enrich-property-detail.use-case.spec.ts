import { describe, expect, it, jest } from '@jest/globals';
import { GeoCoordinateHintService } from 'application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyDetailDomExtractorService } from 'application/services/scraper/property/property-detail-dom-extractor.service';
import { ExtractAndEnrichPropertyDetailUseCase } from 'application/usecases/scraper/extract-and-enrich-property-detail.use-case';
import { HandleDeactivatedPropertyDetailUseCase } from 'application/usecases/scraper/handle-deactivated-property-detail.use-case';
import { PropertyFeatureGroup } from 'domain/property/property-feature-group';
import { PropertyImage } from 'domain/property/property-image';
import { PropertyMainFeatures } from 'domain/property/property-main-features';
import { Property } from 'domain/property/property';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
class HandleDeactivatedPropertyDetailUseCaseMockForExtractAndEnrichPropertyDetailUseCase {
  readonly execute = jest.fn<(runtime: RuntimeClient, url: string) => Promise<boolean>>();
}

class PropertyDetailDomExtractorServiceMockForExtractAndEnrichPropertyDetailUseCase {
  readonly extractProperty = jest.fn<(runtime: RuntimeClient, url: string) => Promise<Property | null>>();
  readonly filterPropertyImagesByBlurPattern = jest.fn<(property: Property) => Property>();
}

class GeoCoordinateHintServiceMockForExtractAndEnrichPropertyDetailUseCase {
  readonly enrichProperty = jest.fn<
    (runtime: RuntimeClient, property: Property, mode: 'ALWAYS' | 'ONLY_WHEN_MISSING_IN_DB') => Promise<Property>
  >();
}

function createRuntime(): RuntimeClient {
  return {
    evaluate: jest.fn(async () => ({ result: { value: true } }))
  };
}

function createProperty(url: string): Property {
  return new Property(
    '123',
    url,
    'Title',
    'Madrid',
    1000,
    new PropertyMainFeatures('80 m2', '2', 'Exterior', []),
    'Comment',
    [new PropertyFeatureGroup('General', ['Ascensor'])],
    'hace 1 día',
    [new PropertyImage('https://img/1.jpg', null)]
  );
}

function createUseCase() {
  const handleDeactivated = new HandleDeactivatedPropertyDetailUseCaseMockForExtractAndEnrichPropertyDetailUseCase();
  const extractor = new PropertyDetailDomExtractorServiceMockForExtractAndEnrichPropertyDetailUseCase();
  const geoCoordinateHint = new GeoCoordinateHintServiceMockForExtractAndEnrichPropertyDetailUseCase();

  const useCase = new ExtractAndEnrichPropertyDetailUseCase(
    handleDeactivated as unknown as HandleDeactivatedPropertyDetailUseCase,
    extractor as unknown as PropertyDetailDomExtractorService,
    geoCoordinateHint as unknown as GeoCoordinateHintService
  );

  return {
    useCase,
    handleDeactivated,
    extractor,
    geoCoordinateHint
  };
}

describe('ExtractAndEnrichPropertyDetailUseCase', () => {
  it('whenExtractedPropertyExists_execute_shouldFilterAndEnrichProperty', async () => {
    // Arrange
    const { useCase, extractor, geoCoordinateHint } = createUseCase();
    const runtime = createRuntime();
    const url = 'https://www.idealista.com/inmueble/1/';
    const extracted = createProperty(url);
    const filtered = createProperty(url);
    const enriched = createProperty(url);
    extractor.extractProperty.mockResolvedValue(extracted);
    extractor.filterPropertyImagesByBlurPattern.mockReturnValue(filtered);
    geoCoordinateHint.enrichProperty.mockResolvedValue(enriched);

    // Action
    const result = await useCase.execute(runtime, url, 'ALWAYS');

    // Assert
    expect(extractor.extractProperty).toHaveBeenCalledWith(runtime, url);
    expect(extractor.filterPropertyImagesByBlurPattern).toHaveBeenCalledWith(extracted);
    expect(geoCoordinateHint.enrichProperty).toHaveBeenCalledWith(runtime, filtered, 'ALWAYS');
    expect(result).toBe(enriched);
  });

  it('whenExtractedPropertyIsMissingAndDeactivatedHandled_execute_shouldReturnNull', async () => {
    // Arrange
    const { useCase, extractor, handleDeactivated, geoCoordinateHint } = createUseCase();
    const runtime = createRuntime();
    const url = 'https://www.idealista.com/inmueble/2/';
    extractor.extractProperty.mockResolvedValue(null);
    handleDeactivated.execute.mockResolvedValue(true);

    // Action
    const result = await useCase.execute(runtime, url, 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    expect(handleDeactivated.execute).toHaveBeenCalledWith(runtime, url);
    expect(geoCoordinateHint.enrichProperty).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('whenExtractedPropertyIsMissingAndNotDeactivated_execute_shouldThrowContainerNotFoundError', async () => {
    // Arrange
    const { useCase, extractor, handleDeactivated } = createUseCase();
    const runtime = createRuntime();
    const url = 'https://www.idealista.com/inmueble/3/';
    extractor.extractProperty.mockResolvedValue(null);
    handleDeactivated.execute.mockResolvedValue(false);

    // Action
    const action = useCase.execute(runtime, url, 'ONLY_WHEN_MISSING_IN_DB');

    // Assert
    await expect(action).rejects.toThrow(
      'Property detail container was not found after loading URL: https://www.idealista.com/inmueble/3/'
    );
    expect(handleDeactivated.execute).toHaveBeenCalledWith(runtime, url);
  });
});
