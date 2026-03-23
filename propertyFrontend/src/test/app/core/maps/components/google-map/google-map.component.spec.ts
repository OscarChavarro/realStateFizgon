import { ElementRef, SimpleChange } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { GoogleMapComponent } from 'src/app/core/maps/components/google-map/google-map.component';
import { GoogleMapKeyboardSelectionResult } from 'src/app/core/maps/services/google-map-selection-controller';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

class MockGoogleMap {
  options: Record<string, unknown>;
  setOptions = jasmine
    .createSpy('setOptions')
    .and.callFake((nextOptions: Record<string, unknown>) => {
      this.options = {
        ...this.options,
        ...nextOptions
      };
    });
  addListener = jasmine.createSpy('addListener').and.returnValue({ remove: () => undefined });

  constructor(_container: HTMLElement, options: Record<string, unknown>) {
    this.options = options;
  }

  getCenter() {
    return {
      lat: () => 40.1,
      lng: () => -3.7
    };
  }

  getProjection() {
    return {};
  }

  getZoom() {
    return 12;
  }

  fitBounds(): void {}
}

class MockGoogleMarker {
  setMap = jasmine.createSpy('setMap');
  private listeners: Record<string, Array<() => void>> = {};
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

  addListener(eventName: string, handler: () => void) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(handler);
    return { remove: () => undefined };
  }

  emit(eventName: string): void {
    for (const handler of this.listeners[eventName] ?? []) {
      handler();
    }
  }
}

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

class GoogleMapsRuntimeLoaderMock {
  googleMaps: any = null;
  loadGoogleMapsScript = jasmine.createSpy('loadGoogleMapsScript').and.resolveTo(undefined);
  waitForGoogleMapsReady = jasmine.createSpy('waitForGoogleMapsReady').and.resolveTo(undefined);
  getGoogleMaps = jasmine.createSpy('getGoogleMaps').and.callFake(() => this.googleMaps);
}

class GoogleMapViewportManagerMock {
  resolveViewport = jasmine.createSpy('resolveViewport').and.returnValue({
    center: { lat: 40.2, lng: -3.6 },
    zoom: 9
  });
  applyViewportToMap = jasmine.createSpy('applyViewportToMap');
  centerMapOnProperty = jasmine.createSpy('centerMapOnProperty');
  refreshMapViewport = jasmine.createSpy('refreshMapViewport');
}

class GoogleMapMarkerIconFactoryMock {
  buildPropertyMarkerIconDataUrl = jasmine
    .createSpy('buildPropertyMarkerIconDataUrl')
    .and.returnValue('data:image/svg+xml,property');
  buildSelectedTargetMarkerIconDataUrl = jasmine
    .createSpy('buildSelectedTargetMarkerIconDataUrl')
    .and.returnValue('data:image/svg+xml,target');
}

class GoogleMapSelectionControllerMock {
  private selected: GoogleMapProperty | null = null;
  handleKeyboardSelection = jasmine
    .createSpy('handleKeyboardSelection')
    .and.returnValue({ type: 'none' } as GoogleMapKeyboardSelectionResult);
  getSelectedPropertySummary = jasmine
    .createSpy('getSelectedPropertySummary')
    .and.callFake(() => this.selected);
  selectProperty = jasmine
    .createSpy('selectProperty')
    .and.callFake((property: GoogleMapProperty) => {
      this.selected = property;
    });
  clearSelection = jasmine.createSpy('clearSelection').and.callFake(() => {
    const hadSelection = this.selected !== null;
    this.selected = null;
    return hadSelection;
  });
  syncSelectionAgainstProperties = jasmine
    .createSpy('syncSelectionAgainstProperties')
    .and.callFake((properties: GoogleMapProperty[]) => {
      if (!this.selected) {
        return null;
      }

      this.selected = properties.find((property) => property.id === this.selected?.id) ?? null;
      return this.selected;
    });
}

class GoogleMapPoiLayerManagerMock {
  readonly layerOptions = [
    { id: 'business', label: 'map.PROPERTY_LOCATION_LAYER_BUSINESS' as const }
  ];
  isLayerEnabled = jasmine.createSpy('isLayerEnabled').and.returnValue(true);
  toggleLayer = jasmine.createSpy('toggleLayer');
  buildMapStyles = jasmine
    .createSpy('buildMapStyles')
    .and.returnValue([
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
    ]);
  onMapReady = jasmine.createSpy('onMapReady');
}

type ComponentFixtureState = {
  component: GoogleMapComponent;
  fixture: ReturnType<typeof TestBed.createComponent<GoogleMapComponent>>;
  runtimeLoaderMock: GoogleMapsRuntimeLoaderMock;
  viewportManagerMock: GoogleMapViewportManagerMock;
  markerIconFactoryMock: GoogleMapMarkerIconFactoryMock;
  selectionControllerMock: GoogleMapSelectionControllerMock;
  poiLayerManagerMock: GoogleMapPoiLayerManagerMock;
  mapContainer: HTMLDivElement;
  mapLayout: HTMLDivElement;
  miniSummary: HTMLDivElement;
};

class GoogleMapComponentMockFactory {
  static createProperty(overrides: Partial<GoogleMapProperty> = {}): GoogleMapProperty {
    return {
      id: 'property-1',
      propertyId: '1',
      title: 'Property 1',
      price: '1500',
      latitude: 40.42,
      longitude: -3.7,
      closed: false,
      review: 'NEW',
      imageUrls: [],
      ...overrides
    };
  }

  static configureGoogleMapsGlobal() {
    const eventTriggerSpy = jasmine.createSpy('eventTrigger');
    const googleMapsApi = {
      Map: MockGoogleMap as any,
      Marker: MockGoogleMarker as any,
      Size: class {
        constructor(_width: number, _height: number) {}
      },
      Point: class {
        constructor(_x: number, _y: number) {}
      },
      OverlayView: MockOverlayView as any,
      event: {
        trigger: eventTriggerSpy
      }
    };

    (window as any).google = {
      maps: googleMapsApi
    };

    return { googleMapsApi, eventTriggerSpy };
  }

  static createComponentWithMocks(): ComponentFixtureState {
    const fixture = TestBed.createComponent(GoogleMapComponent);
    const component = fixture.componentInstance;
    const runtimeLoaderMock = new GoogleMapsRuntimeLoaderMock();
    const viewportManagerMock = new GoogleMapViewportManagerMock();
    const markerIconFactoryMock = new GoogleMapMarkerIconFactoryMock();
    const selectionControllerMock = new GoogleMapSelectionControllerMock();
    const poiLayerManagerMock = new GoogleMapPoiLayerManagerMock();
    const mapContainer = document.createElement('div');
    const mapLayout = document.createElement('div');
    const miniSummary = document.createElement('div');
    mapLayout.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 900,
      height: 640,
      top: 0,
      right: 900,
      bottom: 640,
      left: 0,
      toJSON: () => ({})
    });

    (component as any).runtimeLoader = runtimeLoaderMock;
    (component as any).viewportManager = viewportManagerMock;
    (component as any).markerIconFactory = markerIconFactoryMock;
    (component as any).selectionController = selectionControllerMock;
    (component as any).poiLayerManager = poiLayerManagerMock;
    (component as any).mapContainerRef = new ElementRef(mapContainer);
    (component as any).mapLayoutRef = new ElementRef(mapLayout);
    (component as any).miniSummaryContainerRef = new ElementRef(miniSummary);

    return {
      component,
      fixture,
      runtimeLoaderMock,
      viewportManagerMock,
      markerIconFactoryMock,
      selectionControllerMock,
      poiLayerManagerMock,
      mapContainer,
      mapLayout,
      miniSummary
    };
  }
}

describe('GoogleMapComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GoogleMapComponent]
    });
  });

  it('should translate labels using selected language', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    component.selectedLanguage = 'sp';

    // Action
    const translated = component.t('map.PROPERTY_LOCATION_LAYERS_TITLE');

    // Assert
    expect(translated).toBe('Capas');
  });

  it('ngAfterViewInit should schedule map initialization', fakeAsync(() => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const initializeSpy = spyOn<any>(component, 'initializeMapIfReady').and.resolveTo(undefined);

    // Action
    component.ngAfterViewInit();
    tick(0);

    // Assert
    expect(initializeSpy).toHaveBeenCalled();
  }));

  it('ngOnChanges should schedule initialization and clear selection when interaction gets disabled', fakeAsync(() => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const initializeSpy = spyOn<any>(component, 'initializeMapIfReady').and.resolveTo(undefined);
    const clearSelectionSpy = spyOn<any>(component, 'clearSelectionState');
    const cdrMarkForCheckSpy = spyOn((component as any).cdr, 'markForCheck');
    component.interactionEnabled = false;

    // Action
    component.ngOnChanges({
      properties: new SimpleChange([], [], false),
      interactionEnabled: new SimpleChange(true, false, false)
    });
    tick(0);

    // Assert
    expect(initializeSpy).toHaveBeenCalled();
    expect(clearSelectionSpy).toHaveBeenCalled();
    expect(cdrMarkForCheckSpy).toHaveBeenCalled();
  }));

  [
    'googleMapsApiKey',
    'googleMapsMapId',
    'zoom',
    'preserveViewportOnPropertiesChange',
    'interactionEnabled'
  ].forEach((changeKey) => {
    it(`ngOnChanges should schedule initialization when "${changeKey}" changes`, fakeAsync(() => {
      // Arrange
      const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
      const initializeSpy = spyOn<any>(component, 'initializeMapIfReady').and.resolveTo(undefined);
      const changes = {
        [changeKey]: new SimpleChange(null, null, false)
      } as Record<string, SimpleChange>;

      // Action
      component.ngOnChanges(changes);
      tick(0);

      // Assert
      expect(initializeSpy).toHaveBeenCalled();
    }));
  });

  it('ngOnDestroy should cleanup listeners, map state and markers', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const detachSpy = spyOn<any>(component, 'detachLayerPanelResizeListeners');
    const clearClusterSpy = spyOn<any>(component, 'clearMarkerClusterer');
    const clearMarkersSpy = spyOn<any>(component, 'clearPropertyMarkers');
    const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker');
    (component as any).mapInstance = { setOptions: () => undefined, getCenter: () => null };
    (component as any).mapRenderSignature = 'signature';
    (component as any).isResizingLayerPanel = true;

    // Action
    component.ngOnDestroy();

    // Assert
    expect(detachSpy).toHaveBeenCalled();
    expect(clearClusterSpy).toHaveBeenCalled();
    expect(clearMarkersSpy).toHaveBeenCalled();
    expect(clearSelectedSpy).toHaveBeenCalled();
    expect((component as any).mapInstance).toBeNull();
    expect((component as any).mapRenderSignature).toBeNull();
    expect((component as any).isResizingLayerPanel).toBeFalse();
  });

  it('should delegate layer state methods to the layer manager', () => {
    // Arrange
    const { component, poiLayerManagerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const event = { target: { checked: true } } as unknown as Event;

    // Action
    const enabled = component.isLayerEnabled('business');
    component.onLayerToggle('business', event);

    // Assert
    expect(enabled).toBeTrue();
    expect(poiLayerManagerMock.isLayerEnabled).toHaveBeenCalledWith('business');
    expect(poiLayerManagerMock.toggleLayer).toHaveBeenCalled();
  });

  it('setLayerPanelVisibility should ignore repeated values and update panel when value changes', fakeAsync(() => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const stopResizeSpy = spyOn<any>(component, 'stopLayerPanelResize');
    const refreshSpy = spyOn<any>(component, 'refreshMapViewport');

    // Action
    component.setLayerPanelVisibility(true);
    component.setLayerPanelVisibility(false);
    tick(75);

    // Assert
    expect(component.isLayerPanelVisible).toBeFalse();
    expect(stopResizeSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(2);
  }));

  it('showLayerPanel hideLayerPanel and toggleLayerPanelVisibility should update panel visibility', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();

    // Action
    component.hideLayerPanel();
    const hidden = component.isLayerPanelOpen();
    component.showLayerPanel();
    const shown = component.isLayerPanelOpen();
    component.toggleLayerPanelVisibility();
    const toggled = component.isLayerPanelOpen();

    // Assert
    expect(hidden).toBeFalse();
    expect(shown).toBeTrue();
    expect(toggled).toBeFalse();
  });

  it('onLayerPanelSplitterMouseDown should ignore resize when panel is hidden and start resize when visible', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const attachSpy = spyOn<any>(component, 'attachLayerPanelResizeListeners');
    const hiddenEvent = {
      clientX: 100,
      preventDefault: jasmine.createSpy('preventDefault')
    } as unknown as MouseEvent;
    component.isLayerPanelVisible = false;
    component.onLayerPanelSplitterMouseDown(hiddenEvent);
    component.isLayerPanelVisible = true;
    component.layerPanelWidthPx = 280;
    const visibleEvent = {
      clientX: 120,
      preventDefault: jasmine.createSpy('preventDefault')
    } as unknown as MouseEvent;

    // Action
    component.onLayerPanelSplitterMouseDown(visibleEvent);

    // Assert
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect((component as any).isResizingLayerPanel).toBeTrue();
    expect((component as any).layerPanelStartX).toBe(120);
    expect((component as any).layerPanelStartWidth).toBe(280);
    expect(visibleEvent.preventDefault).toHaveBeenCalled();
  });

  it('onLayerPanelResizeMove should update panel width within bounds and refresh viewport', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const refreshSpy = spyOn<any>(component, 'refreshMapViewport');
    (component as any).isResizingLayerPanel = true;
    (component as any).layerPanelStartX = 100;
    (component as any).layerPanelStartWidth = 220;

    // Action
    (component as any).onLayerPanelResizeMove({ clientX: 600 } as MouseEvent);

    // Assert
    expect(component.layerPanelWidthPx).toBe(580);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('onLayerPanelResizeMove should ignore resize when interaction is not active', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const refreshSpy = spyOn<any>(component, 'refreshMapViewport');
    (component as any).isResizingLayerPanel = false;

    // Action
    (component as any).onLayerPanelResizeMove({ clientX: 400 } as MouseEvent);

    // Assert
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('onLayerPanelResizeMove should return when map layout ref is missing', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const refreshSpy = spyOn<any>(component, 'refreshMapViewport');
    component.layerPanelWidthPx = 240;
    (component as any).isResizingLayerPanel = true;
    (component as any).mapLayoutRef = undefined;

    // Action
    (component as any).onLayerPanelResizeMove({ clientX: 500 } as MouseEvent);

    // Assert
    expect(component.layerPanelWidthPx).toBe(240);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('onLayerPanelResizeEnd should stop resize operation', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const stopSpy = spyOn<any>(component, 'stopLayerPanelResize');

    // Action
    (component as any).onLayerPanelResizeEnd();

    // Assert
    expect(stopSpy).toHaveBeenCalled();
  });

  it('onMapVisualStyleChange should update style and apply map options', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const applyStyleSpy = spyOn<any>(component, 'applyMapVisualStyle');

    // Action
    component.onMapVisualStyleChange('satellite');

    // Assert
    expect(component.selectedMapVisualStyle).toBe('satellite');
    expect(applyStyleSpy).toHaveBeenCalled();
  });

  it('initializeMapIfReady should set missing coordinates message and clear state when no mappable properties exist', fakeAsync(() => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearPropertyMarkersSpy = spyOn<any>(component, 'clearPropertyMarkers');
    const clearSelectedMarkerSpy = spyOn<any>(component, 'clearSelectedTargetMarker');
    component.properties = [GoogleMapComponentMockFactory.createProperty({ latitude: Number.NaN })];
    component.googleMapsApiKey = 'key';

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(component.mapLoadError).toBe('Coordinates are not available for this property.');
    expect(clearPropertyMarkersSpy).toHaveBeenCalled();
    expect(clearSelectedMarkerSpy).toHaveBeenCalled();
  }));

  it('initializeMapIfReady should set not configured message when API key is missing', fakeAsync(() => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearSelectedMarkerSpy = spyOn<any>(component, 'clearSelectedTargetMarker');
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = null;

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(component.mapLoadError).toBe('Google Maps API key is not configured.');
    expect(clearSelectedMarkerSpy).toHaveBeenCalled();
  }));

  it('initializeMapIfReady should handle same signatures with interaction change and missing runtime Google maps', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';
    (component as any).mapInstance = { setOptions: () => undefined, getCenter: () => null };
    (component as any).mapRenderSignature = (component as any).buildConfigSignature();
    (component as any).propertiesRenderSignature = (component as any).buildPropertiesSignature(
      component.properties
    );
    (component as any).markerInteractionEnabledSnapshot = false;
    component.interactionEnabled = true;
    runtimeLoaderMock.googleMaps = null;

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(component.mapLoadError).toBe('Google Maps could not be loaded.');
  }));

  it('initializeMapIfReady should clear selection when interaction changed to disabled and signatures are unchanged', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    const renderMarkersSpy = spyOn<any>(component, 'renderMarkers');
    const clearSelectionSpy = spyOn<any>(component, 'clearSelectionState');
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';
    component.interactionEnabled = false;
    (component as any).mapInstance = { setOptions: () => undefined, getCenter: () => null };
    (component as any).mapRenderSignature = (component as any).buildConfigSignature();
    (component as any).propertiesRenderSignature = (component as any).buildPropertiesSignature(
      component.properties
    );
    (component as any).markerInteractionEnabledSnapshot = true;

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(renderMarkersSpy).toHaveBeenCalled();
    expect(clearSelectionSpy).toHaveBeenCalled();
  }));

  it('initializeMapIfReady should skip re-render when signatures are unchanged and interaction state is unchanged', fakeAsync(() => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const renderMarkersSpy = spyOn<any>(component, 'renderMarkers');
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';
    (component as any).mapInstance = { setOptions: () => undefined, getCenter: () => null };
    (component as any).mapRenderSignature = (component as any).buildConfigSignature();
    (component as any).propertiesRenderSignature = (component as any).buildPropertiesSignature(
      component.properties
    );
    (component as any).markerInteractionEnabledSnapshot = component.interactionEnabled;

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(renderMarkersSpy).not.toHaveBeenCalled();
  }));

  it('initializeMapIfReady should handle property signature change when runtime Google maps are missing', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';
    (component as any).mapInstance = { setOptions: () => undefined, getCenter: () => null };
    (component as any).mapRenderSignature = (component as any).buildConfigSignature();
    (component as any).propertiesRenderSignature = 'different-signature';
    runtimeLoaderMock.googleMaps = null;

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(component.mapLoadError).toBe('Google Maps could not be loaded.');
  }));

  it('initializeMapIfReady should re-render markers and keep viewport when preserveViewportOnPropertiesChange is true', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    const renderMarkersSpy = spyOn<any>(component, 'renderMarkers');
    const applyViewportSpy = spyOn<any>(component, 'applyViewportToMap');
    const syncSelectionSpy = spyOn<any>(component, 'syncSelectedSummaryAgainstProperties');
    const clearSelectionSpy = spyOn<any>(component, 'clearSelectionState');
    component.properties = [
      GoogleMapComponentMockFactory.createProperty(),
      GoogleMapComponentMockFactory.createProperty({
        id: 'property-2',
        propertyId: '2',
        latitude: 40.52,
        longitude: -3.5
      })
    ];
    component.googleMapsApiKey = 'key';
    component.preserveViewportOnPropertiesChange = true;
    component.interactionEnabled = true;
    (component as any).mapInstance = { setOptions: () => undefined, getCenter: () => null };
    (component as any).mapRenderSignature = (component as any).buildConfigSignature();
    (component as any).propertiesRenderSignature = 'different';

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(renderMarkersSpy).toHaveBeenCalled();
    expect(applyViewportSpy).not.toHaveBeenCalled();
    expect(syncSelectionSpy).toHaveBeenCalled();
    expect(clearSelectionSpy).not.toHaveBeenCalled();
  }));

  it('initializeMapIfReady should apply viewport and clear selection when preserveViewportOnPropertiesChange is false and interaction disabled', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    const renderMarkersSpy = spyOn<any>(component, 'renderMarkers');
    const applyViewportSpy = spyOn<any>(component, 'applyViewportToMap');
    const clearSelectionSpy = spyOn<any>(component, 'clearSelectionState');
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';
    component.preserveViewportOnPropertiesChange = false;
    component.interactionEnabled = false;
    (component as any).mapInstance = { setOptions: () => undefined, getCenter: () => null };
    (component as any).mapRenderSignature = (component as any).buildConfigSignature();
    (component as any).propertiesRenderSignature = 'different';

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(renderMarkersSpy).toHaveBeenCalled();
    expect(applyViewportSpy).toHaveBeenCalled();
    expect(clearSelectionSpy).toHaveBeenCalled();
  }));

  it('initializeMapIfReady should create a new map on first render', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    const renderMapSpy = spyOn<any>(component, 'renderMap').and.resolveTo(undefined);
    const syncSelectionSpy = spyOn<any>(component, 'syncSelectedSummaryAgainstProperties');
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';
    component.interactionEnabled = true;

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(runtimeLoaderMock.loadGoogleMapsScript).toHaveBeenCalledWith('key');
    expect(runtimeLoaderMock.waitForGoogleMapsReady).toHaveBeenCalled();
    expect(renderMapSpy).toHaveBeenCalled();
    expect(syncSelectionSpy).toHaveBeenCalled();
    expect((component as any).mapRenderSignature).toBe((component as any).buildConfigSignature());
  }));

  it('initializeMapIfReady should clear selection after first render when interaction is disabled', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    const renderMapSpy = spyOn<any>(component, 'renderMap').and.resolveTo(undefined);
    const clearSelectionSpy = spyOn<any>(component, 'clearSelectionState');
    const syncSelectionSpy = spyOn<any>(component, 'syncSelectedSummaryAgainstProperties');
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';
    component.interactionEnabled = false;

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(renderMapSpy).toHaveBeenCalled();
    expect(clearSelectionSpy).toHaveBeenCalled();
    expect(syncSelectionSpy).not.toHaveBeenCalled();
  }));

  it('initializeMapIfReady should set load error when map initialization throws', fakeAsync(() => {
    // Arrange
    const { component, runtimeLoaderMock, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker');
    runtimeLoaderMock.loadGoogleMapsScript.and.rejectWith(new Error('boom'));
    const consoleErrorSpy = spyOn(console, 'error');
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    component.googleMapsApiKey = 'key';

    // Action
    (component as any).initializeMapIfReady();
    tick();

    // Assert
    expect(component.mapLoadError).toBe('Google Maps could not be loaded.');
    expect(selectionControllerMock.clearSelection).toHaveBeenCalled();
    expect(clearSelectedSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  }));

  it('getMappableProperties should keep only properties with finite coordinates', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    component.properties = [
      GoogleMapComponentMockFactory.createProperty(),
      GoogleMapComponentMockFactory.createProperty({
        id: 'invalid',
        latitude: Number.NaN,
        longitude: -3.6
      })
    ];

    // Action
    const mappable = (component as any).getMappableProperties();

    // Assert
    expect(mappable.length).toBe(1);
    expect(mappable[0].id).toBe('property-1');
  });

  it('renderMap should set load error when runtime or container is not available', async () => {
    // Arrange
    const { component, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    runtimeLoaderMock.googleMaps = null;
    (component as any).mapContainerRef = undefined;

    // Action
    await (component as any).renderMap([GoogleMapComponentMockFactory.createProperty()]);

    // Assert
    expect(component.mapLoadError).toBe('Google Maps could not be loaded.');
  });

  it('renderMap should build map options, render markers and notify POI manager', async () => {
    // Arrange
    const { component, runtimeLoaderMock, viewportManagerMock, poiLayerManagerMock, mapContainer } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    const renderMarkersSpy = spyOn<any>(component, 'renderMarkers');
    component.googleMapsMapId = 'map-id';

    // Action
    await (component as any).renderMap([GoogleMapComponentMockFactory.createProperty()]);

    // Assert
    expect(component.mapLoadError).toBeNull();
    expect(viewportManagerMock.resolveViewport).toHaveBeenCalled();
    expect(renderMarkersSpy).toHaveBeenCalled();
    expect(poiLayerManagerMock.onMapReady).toHaveBeenCalled();
    const mapInstance = (component as any).mapInstance as MockGoogleMap;
    expect(mapInstance).toBeTruthy();
    expect((mapInstance.options as any)['mapId']).toBe('map-id');
    expect((mapInstance.options as any)['mapTypeId']).toBe('roadmap');
    expect((mapInstance.options as any)['styles']).toEqual(
      poiLayerManagerMock.buildMapStyles.calls.mostRecent().returnValue
    );
    expect(mapContainer).toBeTruthy();
  });

  it('renderMarkers should return when map instance is missing', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearClusterSpy = spyOn<any>(component, 'clearMarkerClusterer');
    (component as any).mapInstance = null;
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();

    // Action
    (component as any).renderMarkers(
      [GoogleMapComponentMockFactory.createProperty()],
      googleMapsApi
    );

    // Assert
    expect(clearClusterSpy).not.toHaveBeenCalled();
  });

  it('renderMarkers should create markers, register click handlers and update marker selection', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    const mapInstance = new MockGoogleMap(document.createElement('div'), {});
    (component as any).mapInstance = mapInstance;
    const updateSelectedMarkerSpy = spyOn<any>(component, 'updateSelectedTargetMarker');
    const openSummarySpy = spyOn<any>(component, 'openPropertyMiniSummary');
    component.interactionEnabled = true;
    const properties = [
      GoogleMapComponentMockFactory.createProperty(),
      GoogleMapComponentMockFactory.createProperty({
        id: 'property-2',
        propertyId: '2',
        latitude: 40.52,
        longitude: -3.5
      })
    ];

    // Action
    (component as any).renderMarkers(properties, googleMapsApi);
    const firstMarker = (component as any).propertyMarkerInstances[0] as MockGoogleMarker;
    firstMarker.emit('click');

    // Assert
    expect((component as any).propertyMarkerInstances.length).toBe(2);
    expect((component as any).markerClusterer).toBeTruthy();
    expect((component as any).markerInteractionEnabledSnapshot).toBeTrue();
    expect(updateSelectedMarkerSpy).toHaveBeenCalled();
    expect(openSummarySpy).toHaveBeenCalledWith(properties[0], { focus: true });
  });

  it('renderMarkers should skip click listeners when interaction is disabled', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    (component as any).mapInstance = new MockGoogleMap(document.createElement('div'), {});
    component.interactionEnabled = false;

    // Action
    (component as any).renderMarkers(
      [GoogleMapComponentMockFactory.createProperty()],
      googleMapsApi
    );

    // Assert
    const marker = (component as any).propertyMarkerInstances[0] as MockGoogleMarker;
    marker.emit('click');
    expect((component as any).markerInteractionEnabledSnapshot).toBeFalse();
  });

  it('should delegate viewport helpers and signatures', () => {
    // Arrange
    const { component, viewportManagerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const property = GoogleMapComponentMockFactory.createProperty();
    component.googleMapsApiKey = null;
    component.googleMapsMapId = 'id';
    component.zoom = 11;

    // Action
    (component as any).applyViewportToMap({ center: { lat: 1, lng: 2 }, zoom: 3 });
    (component as any).centerMapOnProperty(property);
    const configSignature = (component as any).buildConfigSignature();
    const propertiesSignature = (component as any).buildPropertiesSignature([
      property,
      GoogleMapComponentMockFactory.createProperty({
        id: 'property-2',
        latitude: 40.52,
        longitude: -3.5,
        review: undefined as unknown as 'NEW',
        closed: true
      })
    ]);

    // Assert
    expect(viewportManagerMock.applyViewportToMap).toHaveBeenCalled();
    expect(viewportManagerMock.centerMapOnProperty).toHaveBeenCalled();
    expect(configSignature).toBe('::id::11');
    expect(propertiesSignature).toContain('property-2:40.52:-3.5:Property 1:closed:NEW');
  });

  it('onPropertyMiniSummaryCloseRequested should clear selection and trigger change detection', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearSelectionSpy = spyOn<any>(component, 'clearSelectionState');
    const markForCheckSpy = spyOn((component as any).cdr, 'markForCheck');

    // Action
    component.onPropertyMiniSummaryCloseRequested();

    // Assert
    expect(clearSelectionSpy).toHaveBeenCalled();
    expect(markForCheckSpy).toHaveBeenCalled();
  });

  it('onWindowKeyDown should delegate keyboard result processing', () => {
    // Arrange
    const { component, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const applyKeyboardSpy = spyOn<any>(component, 'applyKeyboardSelectionResult');
    const keyboardResult: GoogleMapKeyboardSelectionResult = {
      type: 'selected',
      property: GoogleMapComponentMockFactory.createProperty()
    };
    selectionControllerMock.handleKeyboardSelection.and.returnValue(keyboardResult);
    component.interactionEnabled = true;
    component.properties = [GoogleMapComponentMockFactory.createProperty()];
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

    // Action
    component.onWindowKeyDown(event);

    // Assert
    expect(selectionControllerMock.handleKeyboardSelection).toHaveBeenCalled();
    expect(applyKeyboardSpy).toHaveBeenCalledWith(keyboardResult);
  });

  it('openPropertyMiniSummary should support focus and non-focus modes', () => {
    // Arrange
    const { component, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const updateSelectedMarkerSpy = spyOn<any>(component, 'updateSelectedTargetMarker');
    const markForCheckSpy = spyOn((component as any).cdr, 'markForCheck');
    const focusSpy = spyOn<any>(component, 'focusMiniSummary');
    const property = GoogleMapComponentMockFactory.createProperty();

    // Action
    (component as any).openPropertyMiniSummary(property, { focus: true });
    (component as any).openPropertyMiniSummary(property, { focus: false });

    // Assert
    expect(selectionControllerMock.selectProperty).toHaveBeenCalledTimes(2);
    expect(updateSelectedMarkerSpy).toHaveBeenCalledTimes(2);
    expect(markForCheckSpy).toHaveBeenCalledTimes(2);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('openPropertyMiniSummary should support default options argument', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const focusSpy = spyOn<any>(component, 'focusMiniSummary');
    const property = GoogleMapComponentMockFactory.createProperty();

    // Action
    (component as any).openPropertyMiniSummary(property);

    // Assert
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('focusMiniSummary should focus summary container when present and ignore when missing', fakeAsync(() => {
    // Arrange
    const { component, miniSummary } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const focusSpy = spyOn(miniSummary, 'focus');
    const requestAnimationFrameSpy = spyOn(window, 'requestAnimationFrame').and.callFake(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }
    );

    // Action
    (component as any).focusMiniSummary();
    (component as any).miniSummaryContainerRef = undefined;
    (component as any).focusMiniSummary();
    tick();

    // Assert
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  }));

  [
    {
      result: { type: 'none' } as GoogleMapKeyboardSelectionResult,
      selectedMarkerCalls: 0,
      centerCalls: 0,
      focusCalls: 0,
      markCalls: 0
    },
    {
      result: { type: 'closed' } as GoogleMapKeyboardSelectionResult,
      selectedMarkerCalls: 0,
      centerCalls: 0,
      focusCalls: 0,
      markCalls: 1
    },
    {
      result: {
        type: 'selected',
        property: GoogleMapComponentMockFactory.createProperty()
      } as GoogleMapKeyboardSelectionResult,
      selectedMarkerCalls: 1,
      centerCalls: 1,
      focusCalls: 1,
      markCalls: 1
    }
  ].forEach(({ result, selectedMarkerCalls, centerCalls, focusCalls, markCalls }) => {
    it(`applyKeyboardSelectionResult should handle "${result.type}"`, () => {
      // Arrange
      const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
      const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker');
      const updateSelectedSpy = spyOn<any>(component, 'updateSelectedTargetMarker');
      const centerSpy = spyOn<any>(component, 'centerMapOnProperty');
      const focusSpy = spyOn<any>(component, 'focusMiniSummary');
      const markForCheckSpy = spyOn((component as any).cdr, 'markForCheck');

      // Action
      (component as any).applyKeyboardSelectionResult(result);

      // Assert
      expect(updateSelectedSpy).toHaveBeenCalledTimes(selectedMarkerCalls);
      expect(centerSpy).toHaveBeenCalledTimes(centerCalls);
      expect(focusSpy).toHaveBeenCalledTimes(focusCalls);
      expect(markForCheckSpy).toHaveBeenCalledTimes(markCalls);
      if (result.type === 'closed') {
        expect(clearSelectedSpy).toHaveBeenCalled();
      }
    });
  });

  it('applyKeyboardSelectionResult should ignore unknown keyboard result types', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const updateSelectedSpy = spyOn<any>(component, 'updateSelectedTargetMarker');
    const centerSpy = spyOn<any>(component, 'centerMapOnProperty');
    const focusSpy = spyOn<any>(component, 'focusMiniSummary');
    const markForCheckSpy = spyOn((component as any).cdr, 'markForCheck');

    // Action
    (component as any).applyKeyboardSelectionResult({
      type: 'mystery'
    } as unknown as GoogleMapKeyboardSelectionResult);

    // Assert
    expect(updateSelectedSpy).not.toHaveBeenCalled();
    expect(centerSpy).not.toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
    expect(markForCheckSpy).not.toHaveBeenCalled();
  });

  it('syncSelectedSummaryAgainstProperties should clear target marker when selection disappears', () => {
    // Arrange
    const { component, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker');
    selectionControllerMock.syncSelectionAgainstProperties.and.returnValue(null);

    // Action
    (component as any).syncSelectedSummaryAgainstProperties([
      GoogleMapComponentMockFactory.createProperty()
    ]);

    // Assert
    expect(clearSelectedSpy).toHaveBeenCalled();
  });

  it('syncSelectedSummaryAgainstProperties should keep target marker and mark for check when selection exists', () => {
    // Arrange
    const { component, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const updateSelectedSpy = spyOn<any>(component, 'updateSelectedTargetMarker');
    const markForCheckSpy = spyOn((component as any).cdr, 'markForCheck');
    selectionControllerMock.syncSelectionAgainstProperties.and.returnValue(
      GoogleMapComponentMockFactory.createProperty()
    );

    // Action
    (component as any).syncSelectedSummaryAgainstProperties([
      GoogleMapComponentMockFactory.createProperty()
    ]);

    // Assert
    expect(updateSelectedSpy).toHaveBeenCalled();
    expect(markForCheckSpy).toHaveBeenCalled();
  });

  it('updateSelectedTargetMarker should handle disabled interaction, missing map and missing selected summary', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker');
    component.interactionEnabled = false;

    // Action
    (component as any).updateSelectedTargetMarker();
    component.interactionEnabled = true;
    (component as any).mapInstance = null;
    (component as any).updateSelectedTargetMarker();
    (component as any).mapInstance = new MockGoogleMap(document.createElement('div'), {});
    (component as any).selectionController.getSelectedPropertySummary.and.returnValue(null);
    (component as any).updateSelectedTargetMarker();

    // Assert
    expect(clearSelectedSpy).toHaveBeenCalledTimes(3);
  });

  it('updateSelectedTargetMarker should create marker when selected property exists and runtime Google maps are ready', () => {
    // Arrange
    const { component, runtimeLoaderMock, markerIconFactoryMock, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    (component as any).mapInstance = new MockGoogleMap(document.createElement('div'), {});
    selectionControllerMock.getSelectedPropertySummary.and.returnValue(
      GoogleMapComponentMockFactory.createProperty({ latitude: 40.3, longitude: -3.2 })
    );

    // Action
    (component as any).updateSelectedTargetMarker();

    // Assert
    expect(markerIconFactoryMock.buildSelectedTargetMarkerIconDataUrl).toHaveBeenCalled();
    expect((component as any).selectedTargetMarker).toBeTruthy();
  });

  it('updateSelectedTargetMarker should return when runtime Google maps are not available', () => {
    // Arrange
    const { component, runtimeLoaderMock, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    runtimeLoaderMock.googleMaps = null;
    (component as any).mapInstance = new MockGoogleMap(document.createElement('div'), {});
    selectionControllerMock.getSelectedPropertySummary.and.returnValue(
      GoogleMapComponentMockFactory.createProperty()
    );
    const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker').and.callThrough();

    // Action
    (component as any).updateSelectedTargetMarker();

    // Assert
    expect(clearSelectedSpy).not.toHaveBeenCalled();
    expect((component as any).selectedTargetMarker).toBeNull();
  });

  it('updateSelectedTargetMarker should return when selection is null after shouldClear returns false', () => {
    // Arrange
    const { component, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    (component as any).mapInstance = new MockGoogleMap(document.createElement('div'), {});
    selectionControllerMock.getSelectedPropertySummary.and.returnValue(null);
    spyOn((component as any).mapSelectionUseCaseService, 'shouldClearSelectedTargetMarker').and.returnValue(
      false
    );
    const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker');

    // Action
    (component as any).updateSelectedTargetMarker();

    // Assert
    expect(clearSelectedSpy).not.toHaveBeenCalled();
    expect((component as any).selectedTargetMarker).toBeNull();
  });

  it('clearSelectedTargetMarker should clear selected marker when present and ignore when missing', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const marker = {
      setMap: jasmine.createSpy('setMap')
    };
    (component as any).selectedTargetMarker = marker;

    // Action
    (component as any).clearSelectedTargetMarker();
    (component as any).clearSelectedTargetMarker();

    // Assert
    expect(marker.setMap).toHaveBeenCalledOnceWith(null);
    expect((component as any).selectedTargetMarker).toBeNull();
  });

  it('clearSelectionState should clear controller and selected marker', () => {
    // Arrange
    const { component, selectionControllerMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const clearSelectedSpy = spyOn<any>(component, 'clearSelectedTargetMarker');

    // Action
    (component as any).clearSelectionState();

    // Assert
    expect(selectionControllerMock.clearSelection).toHaveBeenCalled();
    expect(clearSelectedSpy).toHaveBeenCalled();
  });

  it('attach and detach resize listeners should bind and unbind DOM events', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const addEventListenerSpy = spyOn(document, 'addEventListener');
    const removeEventListenerSpy = spyOn(document, 'removeEventListener');

    // Action
    (component as any).attachLayerPanelResizeListeners();
    (component as any).detachLayerPanelResizeListeners();

    // Assert
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      (component as any).onLayerPanelResizeMove
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      (component as any).onLayerPanelResizeEnd
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      (component as any).onLayerPanelResizeMove
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      (component as any).onLayerPanelResizeEnd
    );
  });

  it('stopLayerPanelResize should disable resizing and detach listeners', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    (component as any).isResizingLayerPanel = true;
    const detachSpy = spyOn<any>(component, 'detachLayerPanelResizeListeners');

    // Action
    (component as any).stopLayerPanelResize();

    // Assert
    expect((component as any).isResizingLayerPanel).toBeFalse();
    expect(detachSpy).toHaveBeenCalled();
  });

  it('clearPropertyMarkers should call setMap(null) on all markers and reset marker list', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const markerA = { setMap: jasmine.createSpy('setMapA') };
    const markerB = { setMap: jasmine.createSpy('setMapB') };
    (component as any).propertyMarkerInstances = [markerA, markerB];

    // Action
    (component as any).clearPropertyMarkers();

    // Assert
    expect(markerA.setMap).toHaveBeenCalledWith(null);
    expect(markerB.setMap).toHaveBeenCalledWith(null);
    expect((component as any).propertyMarkerInstances).toEqual([]);
  });

  it('clearMarkerClusterer should clear markers only when clusterer exists', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const clusterer = {
      clearMarkers: jasmine.createSpy('clearMarkers')
    };
    (component as any).markerClusterer = clusterer;

    // Action
    (component as any).clearMarkerClusterer();
    (component as any).clearMarkerClusterer();

    // Assert
    expect(clusterer.clearMarkers).toHaveBeenCalledTimes(1);
    expect((component as any).markerClusterer).toBeNull();
  });

  it('refreshMapViewport should delegate to viewport manager', () => {
    // Arrange
    const { component, viewportManagerMock, runtimeLoaderMock } =
      GoogleMapComponentMockFactory.createComponentWithMocks();
    const { googleMapsApi } = GoogleMapComponentMockFactory.configureGoogleMapsGlobal();
    runtimeLoaderMock.googleMaps = googleMapsApi;
    (component as any).mapInstance = new MockGoogleMap(document.createElement('div'), {});

    // Action
    (component as any).refreshMapViewport();

    // Assert
    expect(viewportManagerMock.refreshMapViewport).toHaveBeenCalled();
  });

  it('applyMapVisualStyle should skip when map is missing and apply when map exists', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const mapInstance = new MockGoogleMap(document.createElement('div'), {});
    component.selectedMapVisualStyle = 'satellite';

    // Action
    (component as any).applyMapVisualStyle();
    (component as any).mapInstance = mapInstance;
    (component as any).applyMapVisualStyle();

    // Assert
    expect(mapInstance.setOptions).toHaveBeenCalledWith({ mapTypeId: 'satellite' });
  });

  [
    { style: 'vector' as const, expected: 'roadmap' },
    { style: 'satellite' as const, expected: 'satellite' },
    { style: 'hybrid' as const, expected: 'hybrid' }
  ].forEach(({ style, expected }) => {
    it(`resolveMapTypeId should map ${style} to ${expected}`, () => {
      // Arrange
      const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();

      // Action
      const result = (component as any).resolveMapTypeId(style);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('buildPoiLayerContext should return current map instance', () => {
    // Arrange
    const { component } = GoogleMapComponentMockFactory.createComponentWithMocks();
    const mapInstance = new MockGoogleMap(document.createElement('div'), {});
    (component as any).mapInstance = mapInstance;

    // Action
    const context = (component as any).buildPoiLayerContext();

    // Assert
    expect(context).toEqual({ mapInstance });
  });
});
