import { describe, expect, it, jest } from '@jest/globals';
import { GeoCoordinateHintService } from 'src/application/services/scraper/property/geo-coordinate-hint.service';
import { PropertyFeatureGroup } from 'src/domain/property/property-feature-group.model';
import { PropertyImage } from 'src/domain/property/property-image.model';
import { PropertyMainFeatures } from 'src/domain/property/property-main-features.model';
import { Property } from 'src/domain/property/property.model';
import { PropertyPersistencePortMock } from '../../../../ports/outbound/persistence/property-persistence-port.mock';

import type { RuntimeClient } from 'src/application/services/scraper/property/runtime-client.type';
type RuntimeMockResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

function createRuntimeMock(result: RuntimeMockResult): RuntimeClient {
  return {
    evaluate: jest.fn(async () => result)
  };
}

function createProperty(url: string, propertyId: string | null): Property {
  return new Property(
    propertyId,
    url,
    'Title',
    'Madrid',
    1000,
    new PropertyMainFeatures('80m2', '2', '2nd', []),
    'Comment',
    [new PropertyFeatureGroup('General', ['a'])],
    'Anuncio actualizado hace 1 día',
    [new PropertyImage('https://img/1.jpg', null)]
  );
}

describe('GeoCoordinateHintService', () => {
  it('whenModeIsAlwaysAndEndpointHasCoordinates_enrichProperty_shouldSetGeoLocationHint', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906043/', '110906043');
    const runtime = createRuntimeMock({
      result: {
        value: {
          latitudeRaw: '40.5057717',
          longitudeRaw: '-3.695957'
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toEqual({ lat: 40.5057717, lon: -3.695957 });
    expect(propertyPersistencePortMock.hasGeoLocationHintByUrl).not.toHaveBeenCalled();
    expect(runtime.evaluate).toHaveBeenCalledWith(expect.objectContaining({ awaitPromise: true }));
  });

  it('whenModeIsAlwaysAndEndpointHasNoCoordinates_enrichProperty_shouldSetGeoLocationHintNull', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906044/', '110906044');
    const runtime = createRuntimeMock({
      result: {
        value: {
          latitudeRaw: null,
          longitudeRaw: null
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
  });

  it('whenModeIsAlwaysAndRuntimeThrows_enrichProperty_shouldSetGeoLocationHintNull', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906045/', '110906045');
    const runtime: RuntimeClient = {
      evaluate: jest.fn(async () => {
        throw new Error('runtime failed');
      })
    };
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
  });

  it('whenModeIsAlwaysAndRuntimeThrowsNonError_enrichProperty_shouldSetGeoLocationHintNull', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906049/', '110906049');
    const runtime: RuntimeClient = {
      evaluate: jest.fn(async () => {
        throw 'runtime failed as string';
      })
    };
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
  });

  it('whenModeIsOnlyWhenMissingAndGeoAlreadyExists_enrichProperty_shouldSkipRuntimeFetch', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(true);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906046/', '110906046');
    const runtime = createRuntimeMock({
      result: {
        value: {
          latitudeRaw: '40.1',
          longitudeRaw: '-3.1'
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ONLY_WHEN_MISSING_IN_DB');
    // Assert
    expect(enriched).toBe(property);
    expect(propertyPersistencePortMock.hasGeoLocationHintByUrl).toHaveBeenCalledWith(property.url);
    expect(runtime.evaluate).not.toHaveBeenCalled();
  });

  it('whenModeIsOnlyWhenMissingAndGeoHintInDbIsMissing_enrichProperty_shouldRetryGeoHintDownload', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906046/', '110906046');
    const runtime = createRuntimeMock({
      result: {
        value: {
          latitudeRaw: '40.1',
          longitudeRaw: '-3.1'
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ONLY_WHEN_MISSING_IN_DB');
    // Assert
    expect(propertyPersistencePortMock.hasGeoLocationHintByUrl).toHaveBeenCalledWith(property.url);
    expect(runtime.evaluate).toHaveBeenCalledTimes(1);
    expect(enriched.geoLocationHint).toEqual({ lat: 40.1, lon: -3.1 });
  });

  it('whenModeIsOnlyWhenMissingAndPropertyHasNoId_enrichProperty_shouldSetGeoLocationHintNull', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/alquiler-viviendas/madrid/', null);
    const runtime = createRuntimeMock({
      result: {
        value: {
          latitudeRaw: '40.1',
          longitudeRaw: '-3.1'
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ONLY_WHEN_MISSING_IN_DB');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
    expect(runtime.evaluate).not.toHaveBeenCalled();
  });

  it('whenRuntimeReturnsExceptionDetails_enrichProperty_shouldSetGeoLocationHintNull', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906047/', '110906047');
    const runtime = createRuntimeMock({
      exceptionDetails: {
        text: 'execution failed'
      },
      result: {
        value: {
          latitudeRaw: '40.2',
          longitudeRaw: '-3.2'
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
  });

  it('whenCoordinatesAreNestedInPayload_enrichProperty_shouldMapCoordinatesFromPayloadFallback', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906048/', '110906048');
    const runtime = createRuntimeMock({
      result: {
        value: {
          coordinatesRaw: null,
          payload: {
            data: {
              multimedia: {
                maps: [
                  {
                    coordinates: {
                      latitude: '40.5057717',
                      longitude: '-3.695957'
                    }
                  }
                ]
              }
            }
          }
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toEqual({ lat: 40.5057717, lon: -3.695957 });
  });

  it('whenRuntimeReturnsPrimitiveValue_enrichProperty_shouldSetGeoLocationHintNull', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906050/', '110906050');
    const runtime = createRuntimeMock({
      result: {
        value: 42
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
  });

  it.each([
    ['NumericLatitudeLongitude', { coordinatesRaw: { latitude: 40.5, longitude: -3.6 } }, { lat: 40.5, lon: -3.6 }],
    ['LatLonAliases', { coordinatesRaw: { lat: '40.6', lon: '-3.7' } }, { lat: 40.6, lon: -3.7 }]
  ])(
    'whenCoordinatesRawHas%s_enrichProperty_shouldMapGeoLocationHint',
    async (_name, value, expected) => {
      // Arrange
      const propertyPersistencePortMock = new PropertyPersistencePortMock();
      propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
      const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
      const property = createProperty('https://www.idealista.com/inmueble/110906051/', '110906051');
    const runtime = createRuntimeMock({
      result: {
        value
      }
      });
      // Action
      const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
      // Assert
      expect(enriched.geoLocationHint).toEqual(expected);
    }
  );

  it.each([
    ['NonFiniteNumber', { coordinatesRaw: { latitude: Number.POSITIVE_INFINITY, longitude: -3.6 } }],
    ['NonNumericString', { coordinatesRaw: { latitude: 'abc', longitude: '-3.6' } }],
    ['BlankString', { coordinatesRaw: { latitude: '   ', longitude: '-3.6' } }],
    ['NullValue', { coordinatesRaw: { latitude: null, longitude: '-3.6' } }],
    ['NonObjectPayloadRoot', { coordinatesRaw: null, payload: 'not-an-object' }]
  ])('whenCoordinatesContain%s_enrichProperty_shouldSetGeoLocationHintNull', async (_name, value) => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906052/', '110906052');
    const runtime = createRuntimeMock({
      result: {
        value
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
  });

  it('whenPayloadIsArrayWithMixedAndDuplicatedEntries_enrichProperty_shouldFindCoordinatesAndHandleVisitedNodes', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906053/', '110906053');
    const shared = { foo: { bar: 1 }, nullable: null };
    const runtime = createRuntimeMock({
      result: {
        value: {
          coordinatesRaw: null,
          payload: [
            { coordinates: { latitude: '40.61', longitude: '-3.71' } },
            shared,
            shared,
            123,
            null
          ]
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toEqual({ lat: 40.61, lon: -3.71 });
  });

  it('whenPayloadContainsOnlyPartialCoordinates_enrichProperty_shouldReturnNullAfterGraphTraversal', async () => {
    // Arrange
    const propertyPersistencePortMock = new PropertyPersistencePortMock();
    propertyPersistencePortMock.hasGeoLocationHintByUrl.mockResolvedValue(false);
    const service = new GeoCoordinateHintService(propertyPersistencePortMock as never);
    const property = createProperty('https://www.idealista.com/inmueble/110906054/', '110906054');
    const runtime = createRuntimeMock({
      result: {
        value: {
          coordinatesRaw: null,
          payload: {
            data: {
              multimedia: {
                maps: [
                  {
                    coordinates: {
                      lat: '40.99'
                    }
                  }
                ]
              }
            }
          }
        }
      }
    });
    // Action
    const enriched = await service.enrichProperty(runtime, property, 'ALWAYS');
    // Assert
    expect(enriched.geoLocationHint).toBeNull();
  });
});
