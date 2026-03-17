import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';
import { GoogleMapMarkerIconFactory } from 'src/app/core/maps/services/google-map-marker-icon-factory';
import { GoogleMapMarkerRenderingPresenterService } from 'src/app/core/maps/services/google-map-marker-rendering.presenter.service';

class MockGoogleMap {
  setOptions = jasmine.createSpy('setOptions');
  addListener = jasmine.createSpy('addListener').and.returnValue({ remove: () => undefined });

  getCenter() {
    return {
      lat: () => 40.1,
      lng: () => -3.7
    };
  }
}

class MockGoogleMarker {
  setMap = jasmine.createSpy('setMap');
  addListener = jasmine.createSpy('addListener').and.returnValue({ remove: () => undefined });
  readonly options: Record<string, unknown>;

  constructor(options: Record<string, unknown>) {
    this.options = options;
  }

  getPosition() {
    const position = this.options['position'] as { lat: number; lng: number };
    return {
      lat: () => position.lat,
      lng: () => position.lng
    };
  }

  getVisible() {
    return true;
  }
}

function createProperty(overrides: Partial<GoogleMapProperty> = {}): GoogleMapProperty {
  return {
    id: 'property-1',
    propertyId: '1',
    title: 'Property 1',
    price: '1500',
    latitude: 40.4,
    longitude: -3.7,
    closed: false,
    review: 'NEW',
    imageUrls: [],
    ...overrides
  };
}

describe('GoogleMapMarkerRenderingPresenterService', () => {
  beforeEach(() => {
    function MockOverlayView(this: { map?: unknown }) {
      this.map = null;
    }

    MockOverlayView.prototype.setMap = function (map: unknown): void {
      this.map = map;
    };

    MockOverlayView.prototype.getMap = function (): unknown {
      return this.map;
    };

    MockOverlayView.prototype.getProjection = function () {
      return {};
    };

    MockOverlayView.prototype.addListener = function () {
      return { remove: () => undefined };
    };

    (window as any).google = {
      maps: {
        OverlayView: MockOverlayView as any,
        event: {
          trigger: () => undefined
        }
      }
    };
  });

  it('renderPropertyMarkers should create markers and register click handlers when interaction is enabled', () => {
    // Arrange
    const service = new GoogleMapMarkerRenderingPresenterService();
    const clickedIds: string[] = [];
    const googleMapsApi = {
      Marker: MockGoogleMarker as any,
      Size: class {
        constructor(_width: number, _height: number) {}
      },
      Point: class {
        constructor(_x: number, _y: number) {}
      }
    } as any;
    const iconFactory = new GoogleMapMarkerIconFactory();

    // Action
    const result = service.renderPropertyMarkers({
      mapInstance: new MockGoogleMap() as any,
      properties: [createProperty()],
      googleMaps: googleMapsApi,
      interactionEnabled: true,
      markerIconFactory: iconFactory,
      onMarkerClick: (property) => clickedIds.push(property.id)
    });
    const marker = result.propertyMarkerInstances[0] as unknown as MockGoogleMarker;
    (marker.addListener.calls.mostRecent().args[1] as () => void)();

    // Assert
    expect(result.propertyMarkerInstances.length).toBe(1);
    expect(result.markerClusterer).toBeTruthy();
    expect(clickedIds).toEqual(['property-1']);
  });

  it('renderPropertyMarkers should not register click handlers when interaction is disabled', () => {
    // Arrange
    const service = new GoogleMapMarkerRenderingPresenterService();
    const googleMapsApi = {
      Marker: MockGoogleMarker as any,
      Size: class {
        constructor(_width: number, _height: number) {}
      },
      Point: class {
        constructor(_x: number, _y: number) {}
      }
    } as any;

    // Action
    const result = service.renderPropertyMarkers({
      mapInstance: new MockGoogleMap() as any,
      properties: [createProperty()],
      googleMaps: googleMapsApi,
      interactionEnabled: false,
      markerIconFactory: new GoogleMapMarkerIconFactory(),
      onMarkerClick: () => undefined
    });
    const marker = result.propertyMarkerInstances[0] as unknown as MockGoogleMarker;

    // Assert
    expect(marker.addListener).not.toHaveBeenCalled();
  });

  it('createSelectedTargetMarker should build marker positioned at selected property', () => {
    // Arrange
    const service = new GoogleMapMarkerRenderingPresenterService();
    const googleMapsApi = {
      Marker: MockGoogleMarker as any,
      Size: class {
        constructor(_width: number, _height: number) {}
      },
      Point: class {
        constructor(_x: number, _y: number) {}
      }
    } as any;
    const selectedProperty = createProperty({ latitude: 41.2, longitude: -2.1 });

    // Action
    const marker = service.createSelectedTargetMarker({
      mapInstance: new MockGoogleMap() as any,
      selectedProperty,
      googleMaps: googleMapsApi,
      markerIconFactory: new GoogleMapMarkerIconFactory()
    }) as unknown as MockGoogleMarker;

    // Assert
    expect(marker.options['position']).toEqual({ lat: 41.2, lng: -2.1 });
    expect(marker.options['zIndex']).toBe(3000);
  });
});
