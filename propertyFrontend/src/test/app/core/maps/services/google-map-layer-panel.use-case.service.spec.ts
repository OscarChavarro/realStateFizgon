import { GoogleMapLayerPanelUseCaseService } from 'src/app/core/maps/services/google-map-layer-panel.use-case.service';

describe('GoogleMapLayerPanelUseCaseService', () => {
  it('shouldStartResize should mirror layer panel visibility', () => {
    // Arrange
    const service = new GoogleMapLayerPanelUseCaseService();

    // Action
    const hiddenPanelResult = service.shouldStartResize(false);
    const visiblePanelResult = service.shouldStartResize(true);

    // Assert
    expect(hiddenPanelResult).toBeFalse();
    expect(visiblePanelResult).toBeTrue();
  });

  it('shouldApplyVisibilityChange should indicate if visibility changes', () => {
    // Arrange
    const service = new GoogleMapLayerPanelUseCaseService();

    // Action
    const unchangedResult = service.shouldApplyVisibilityChange(true, true);
    const changedResult = service.shouldApplyVisibilityChange(true, false);

    // Assert
    expect(unchangedResult).toBeFalse();
    expect(changedResult).toBeTrue();
  });

  it('calculateResizedPanelWidth should return null when resize is inactive', () => {
    // Arrange
    const service = new GoogleMapLayerPanelUseCaseService();

    // Action
    const value = service.calculateResizedPanelWidth({
      isResizingLayerPanel: false,
      layoutWidth: 1000,
      clientX: 300,
      layerPanelStartX: 200,
      layerPanelStartWidth: 220
    });

    // Assert
    expect(value).toBeNull();
  });

  it('calculateResizedPanelWidth should clamp width in range and respect max threshold', () => {
    // Arrange
    const service = new GoogleMapLayerPanelUseCaseService();

    // Action
    const clampedToMin = service.calculateResizedPanelWidth({
      isResizingLayerPanel: true,
      layoutWidth: 1000,
      clientX: 100,
      layerPanelStartX: 400,
      layerPanelStartWidth: 200
    });
    const clampedToMax = service.calculateResizedPanelWidth({
      isResizingLayerPanel: true,
      layoutWidth: 700,
      clientX: 900,
      layerPanelStartX: 400,
      layerPanelStartWidth: 220
    });
    const withinRange = service.calculateResizedPanelWidth({
      isResizingLayerPanel: true,
      layoutWidth: 900,
      clientX: 500,
      layerPanelStartX: 300,
      layerPanelStartWidth: 220
    });

    // Assert
    expect(clampedToMin).toBe(180);
    expect(clampedToMax).toBe(380);
    expect(withinRange).toBe(420);
  });
});
