import { GoogleMapRenderUseCaseService } from 'src/app/core/maps/services/google-map-render.use-case.service';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

describe('GoogleMapRenderUseCaseService', () => {
  function createProperty(overrides: Partial<GoogleMapProperty> = {}): GoogleMapProperty {
    return {
      id: 'property-1',
      propertyId: '1',
      title: 'Property 1',
      price: '1500',
      latitude: 40.1,
      longitude: -3.7,
      closed: false,
      review: 'NEW',
      imageUrls: [],
      ...overrides
    };
  }

  it('getMappableProperties should keep only properties with finite coordinates', () => {
    // Arrange
    const service = new GoogleMapRenderUseCaseService();
    const properties = [
      createProperty(),
      createProperty({ id: 'property-2', latitude: Number.NaN }),
      createProperty({ id: 'property-3', longitude: Number.POSITIVE_INFINITY })
    ];

    // Action
    const result = service.getMappableProperties(properties);

    // Assert
    expect(result.map((property) => property.id)).toEqual(['property-1']);
  });

  it('buildConfigSignature should combine nullable api key map id and zoom', () => {
    // Arrange
    const service = new GoogleMapRenderUseCaseService();

    // Action
    const firstSignature = service.buildConfigSignature(null, 'map-id', 12);
    const secondSignature = service.buildConfigSignature('api-key', null, 15);

    // Assert
    expect(firstSignature).toBe('::map-id::12');
    expect(secondSignature).toBe('api-key::::15');
  });

  it('buildPropertiesSignature should encode open and closed states and review value', () => {
    // Arrange
    const service = new GoogleMapRenderUseCaseService();
    const properties = [
      createProperty(),
      createProperty({
        id: 'property-2',
        title: 'Property 2',
        latitude: 40.2,
        longitude: -3.8,
        closed: true
      })
    ];

    // Action
    const signature = service.buildPropertiesSignature(properties);

    // Assert
    expect(signature).toContain('property-1:40.1:-3.7:Property 1:open:NEW');
    expect(signature).toContain('property-2:40.2:-3.8:Property 2:closed:NEW');
  });

  [
    { style: 'vector' as const, expected: 'roadmap' as const },
    { style: 'satellite' as const, expected: 'satellite' as const },
    { style: 'hybrid' as const, expected: 'hybrid' as const }
  ].forEach(({ style, expected }) => {
    it(`resolveMapTypeId should return ${expected} for ${style}`, () => {
      // Arrange
      const service = new GoogleMapRenderUseCaseService();

      // Action
      const result = service.resolveMapTypeId(style);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('buildMapOptions should include mapId only when it exists', () => {
    // Arrange
    const service = new GoogleMapRenderUseCaseService();
    const params = {
      viewport: {
        center: { lat: 40.4, lng: -3.6 },
        zoom: 13
      },
      selectedMapVisualStyle: 'hybrid' as const,
      styles: [{ featureType: 'poi' }]
    };

    // Action
    const withoutMapId = service.buildMapOptions({
      ...params,
      googleMapsMapId: null
    });
    const withMapId = service.buildMapOptions({
      ...params,
      selectedMapVisualStyle: 'satellite',
      googleMapsMapId: 'map-id'
    });

    // Assert
    expect(withoutMapId['mapId']).toBeUndefined();
    expect(withMapId['mapId']).toBe('map-id');
    expect(withMapId['mapTypeId']).toBe('satellite');
    expect(withMapId['center']).toEqual({ lat: 40.4, lng: -3.6 });
    expect(withMapId['zoom']).toBe(13);
  });
});
