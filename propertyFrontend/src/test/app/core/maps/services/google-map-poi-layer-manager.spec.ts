import { GoogleMapPoiLayerManager } from 'src/app/core/maps/services/google-map-poi-layer-manager';

class GoogleMapPoiLayerManagerMockFactory {
  static createPoiMap() {
    return {
      setOptions: jasmine.createSpy('setOptions')
    };
  }
}

describe('GoogleMapPoiLayerManager', () => {
  let manager: GoogleMapPoiLayerManager;

  beforeEach(() => {
    manager = new GoogleMapPoiLayerManager();
  });

  it('should expose expected default layer selection state', () => {
    // Arrange

    // Action
    const business = manager.isLayerEnabled('business');
    const hospitals = manager.isLayerEnabled('hospitals');
    const metroStations = manager.isLayerEnabled('metroStations');
    const schools = manager.isLayerEnabled('schools');

    // Assert
    expect(business).toBeFalse();
    expect(hospitals).toBeFalse();
    expect(metroStations).toBeTrue();
    expect(schools).toBeFalse();
  });

  it('onMapReady should apply styles when map instance exists', () => {
    // Arrange
    const mapInstance = GoogleMapPoiLayerManagerMockFactory.createPoiMap();

    // Action
    manager.onMapReady({ mapInstance });

    // Assert
    expect(mapInstance.setOptions).toHaveBeenCalledTimes(1);
    expect(mapInstance.setOptions).toHaveBeenCalledWith({
      styles: manager.buildMapStyles()
    });
  });

  it('onMapReady should do nothing when map instance is null', () => {
    // Arrange

    // Action
    manager.onMapReady({ mapInstance: null });

    // Assert
    expect(manager.buildMapStyles().length).toBeGreaterThan(0);
  });

  it('toggleLayer should update state and apply styles', () => {
    // Arrange
    const mapInstance = GoogleMapPoiLayerManagerMockFactory.createPoiMap();

    // Action
    manager.toggleLayer('business', true, { mapInstance });

    // Assert
    expect(manager.isLayerEnabled('business')).toBeTrue();
    expect(mapInstance.setOptions).toHaveBeenCalledWith({
      styles: manager.buildMapStyles()
    });
  });

  it('buildMapStyles should include base styles and enabled layer rules', () => {
    // Arrange
    manager.toggleLayer('business', true, { mapInstance: null });
    manager.toggleLayer('hospitals', true, { mapInstance: null });
    manager.toggleLayer('schools', true, { mapInstance: null });

    // Action
    const styles = manager.buildMapStyles();

    // Assert
    expect(styles.length).toBeGreaterThan(6);
    expect(styles).toContain(
      jasmine.objectContaining({
        featureType: 'transit.line',
        elementType: 'labels'
      })
    );
    expect(styles).toContain(
      jasmine.objectContaining({
        featureType: 'poi.business',
        elementType: 'labels'
      })
    );
    expect(styles).toContain(
      jasmine.objectContaining({
        featureType: 'poi.medical',
        elementType: 'geometry'
      })
    );
    expect(styles).toContain(
      jasmine.objectContaining({
        featureType: 'poi.school',
        elementType: 'labels'
      })
    );
  });

  it('buildMapStyles should deduplicate repeated style rules', () => {
    // Arrange
    const duplicateRule = {
      featureType: 'poi.business',
      elementType: 'labels',
      stylers: [{ visibility: 'on' as const }]
    };
    (manager.layerOptions[0].mapFeatureStyles as any).push(duplicateRule, duplicateRule);
    manager.toggleLayer('business', true, { mapInstance: null });

    // Action
    const styles = manager.buildMapStyles();
    const duplicateMatches = styles.filter((rule) => (
      rule.featureType === 'poi.business'
      && rule.elementType === 'labels'
      && rule.stylers.some((styler) => styler.visibility === 'on')
    ));

    // Assert
    expect(duplicateMatches.length).toBe(1);
  });
});
