import { GoogleMapViewportManager } from 'src/app/core/maps/services/google-map-viewport-manager';

class GoogleMapViewportManagerMockFactory {
  static createProperty(overrides: Partial<{
    id: string;
    propertyId: string;
    title: string;
    price: string;
    latitude: number;
    longitude: number;
    review: 'NEW' | 'FAVOURITE' | 'DISCHARGED';
    imageUrls: string[];
  }> = {}) {
    return {
      id: 'property-1',
      propertyId: '1',
      title: 'Property 1',
      price: '1400',
      latitude: 40.4,
      longitude: -3.7,
      review: 'NEW' as const,
      imageUrls: [] as string[],
      ...overrides
    };
  }

  static createMapWithCenter(
    center: { lat: (() => number) | number; lng: (() => number) | number } | null = { lat: 40.4, lng: -3.7 }
  ) {
    return {
      setOptions: jasmine.createSpy('setOptions'),
      getCenter: jasmine.createSpy('getCenter').and.returnValue(center)
    };
  }
}

describe('GoogleMapViewportManager', () => {
  let manager: GoogleMapViewportManager;

  beforeEach(() => {
    manager = new GoogleMapViewportManager();
  });

  it('resolveViewport should use single property center with provided zoom', () => {
    // Arrange
    const property = GoogleMapViewportManagerMockFactory.createProperty({
      latitude: 40.7,
      longitude: -3.1
    });

    // Action
    const viewport = manager.resolveViewport([property], 14);

    // Assert
    expect(viewport).toEqual({
      center: { lat: 40.7, lng: -3.1 },
      zoom: 14
    });
  });

  it('resolveViewport should compute min/max center for multiple properties and fixed zoom', () => {
    // Arrange
    const properties = [
      GoogleMapViewportManagerMockFactory.createProperty({ latitude: 40.0, longitude: -4.0 }),
      GoogleMapViewportManagerMockFactory.createProperty({ id: 'p2', propertyId: '2', latitude: 42.0, longitude: -2.0 }),
      GoogleMapViewportManagerMockFactory.createProperty({ id: 'p3', propertyId: '3', latitude: 41.0, longitude: -3.0 })
    ];

    // Action
    const viewport = manager.resolveViewport(properties, 14);

    // Assert
    expect(viewport).toEqual({
      center: { lat: 41, lng: -3 },
      zoom: 10
    });
  });

  it('applyViewportToMap should skip null map and set options when map exists', () => {
    // Arrange
    const mapInstance = GoogleMapViewportManagerMockFactory.createMapWithCenter();
    const viewport = { center: { lat: 10, lng: 20 }, zoom: 7 };

    // Action
    manager.applyViewportToMap(null as any, viewport);
    manager.applyViewportToMap(mapInstance as any, viewport);

    // Assert
    expect(mapInstance.setOptions).toHaveBeenCalledOnceWith({
      center: { lat: 10, lng: 20 },
      zoom: 7
    });
  });

  it('centerMapOnProperty should skip null map and set center when map exists', () => {
    // Arrange
    const mapInstance = GoogleMapViewportManagerMockFactory.createMapWithCenter();
    const property = GoogleMapViewportManagerMockFactory.createProperty({ latitude: 50.5, longitude: -1.2 });

    // Action
    manager.centerMapOnProperty(null as any, property);
    manager.centerMapOnProperty(mapInstance as any, property);

    // Assert
    expect(mapInstance.setOptions).toHaveBeenCalledOnceWith({
      center: {
        lat: 50.5,
        lng: -1.2
      }
    });
  });

  it('refreshMapViewport should skip when map is null', () => {
    // Arrange
    const triggerSpy = jasmine.createSpy('trigger');

    // Action
    manager.refreshMapViewport(null as any, { event: { trigger: triggerSpy } } as any);

    // Assert
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('refreshMapViewport should trigger resize and restore center when center is valid function-based LatLng', () => {
    // Arrange
    const mapInstance = GoogleMapViewportManagerMockFactory.createMapWithCenter({
      lat: () => 40.11,
      lng: () => -3.77
    });
    const triggerSpy = jasmine.createSpy('trigger');

    // Action
    manager.refreshMapViewport(mapInstance as any, { event: { trigger: triggerSpy } } as any);

    // Assert
    expect(triggerSpy).toHaveBeenCalledOnceWith(mapInstance as any, 'resize');
    expect(mapInstance.setOptions).toHaveBeenCalledWith({
      center: { lat: 40.11, lng: -3.77 }
    });
  });

  it('refreshMapViewport should set center without triggering resize when googleMaps.event is missing', () => {
    // Arrange
    const mapInstance = GoogleMapViewportManagerMockFactory.createMapWithCenter({ lat: 40.2, lng: -3.8 });

    // Action
    manager.refreshMapViewport(mapInstance as any, null as any);

    // Assert
    expect(mapInstance.setOptions).toHaveBeenCalledWith({
      center: { lat: 40.2, lng: -3.8 }
    });
  });

  it('refreshMapViewport should not set center when lat or lng is invalid', () => {
    // Arrange
    const mapInvalidLat = GoogleMapViewportManagerMockFactory.createMapWithCenter({
      lat: () => Number.NaN,
      lng: () => -3.8
    });
    const mapInvalidLng = GoogleMapViewportManagerMockFactory.createMapWithCenter({
      lat: 40.2,
      lng: Number.POSITIVE_INFINITY
    });

    // Action
    manager.refreshMapViewport(mapInvalidLat as any, null as any);
    manager.refreshMapViewport(mapInvalidLng as any, null as any);

    // Assert
    expect(mapInvalidLat.setOptions).not.toHaveBeenCalled();
    expect(mapInvalidLng.setOptions).not.toHaveBeenCalled();
  });

  [
    { source: null, axis: 'lat' as const, expected: null },
    { source: undefined, axis: 'lng' as const, expected: null },
    { source: { lat: 10, lng: 20 }, axis: 'lat' as const, expected: 10 },
    { source: { lat: () => 30, lng: () => 40 }, axis: 'lng' as const, expected: 40 },
    { source: { lat: () => Number.NaN, lng: () => 2 }, axis: 'lat' as const, expected: null }
  ].forEach(({ source, axis, expected }) => {
    it(`private readLatLng should return ${String(expected)} for axis ${axis}`, () => {
      // Arrange

      // Action
      const value = (manager as any).readLatLng(source, axis);

      // Assert
      expect(value).toBe(expected);
    });
  });
});
