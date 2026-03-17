import { GoogleMapSelectionUseCaseService } from 'src/app/core/maps/services/google-map-selection.use-case.service';
import { GoogleMapKeyboardSelectionResult } from 'src/app/core/maps/services/google-map-selection-controller';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

describe('GoogleMapSelectionUseCaseService', () => {
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

  it('shouldClearSelectedTargetMarker should return true for invalid marker rendering context', () => {
    // Arrange
    const service = new GoogleMapSelectionUseCaseService();
    const selected = createProperty();

    // Action
    const interactionDisabled = service.shouldClearSelectedTargetMarker(false, {} as never, selected);
    const mapMissing = service.shouldClearSelectedTargetMarker(true, null, selected);
    const selectionMissing = service.shouldClearSelectedTargetMarker(true, {} as never, null);

    // Assert
    expect(interactionDisabled).toBeTrue();
    expect(mapMissing).toBeTrue();
    expect(selectionMissing).toBeTrue();
  });

  it('shouldClearSelectedTargetMarker should return false when context is valid', () => {
    // Arrange
    const service = new GoogleMapSelectionUseCaseService();

    // Action
    const result = service.shouldClearSelectedTargetMarker(
      true,
      {} as never,
      createProperty()
    );

    // Assert
    expect(result).toBeFalse();
  });

  [
    { result: { type: 'none' } as GoogleMapKeyboardSelectionResult, expected: false },
    { result: { type: 'closed' } as GoogleMapKeyboardSelectionResult, expected: true },
    {
      result: { type: 'selected', property: createProperty() } as GoogleMapKeyboardSelectionResult,
      expected: false
    }
  ].forEach(({ result, expected }) => {
    it(`isKeyboardSelectionClosed should return ${expected} for "${result.type}"`, () => {
      // Arrange
      const service = new GoogleMapSelectionUseCaseService();

      // Action
      const value = service.isKeyboardSelectionClosed(result);

      // Assert
      expect(value).toBe(expected);
    });
  });

  it('isKeyboardSelectionSelected should discriminate selected keyboard result', () => {
    // Arrange
    const service = new GoogleMapSelectionUseCaseService();
    const selectedResult = {
      type: 'selected',
      property: createProperty()
    } as GoogleMapKeyboardSelectionResult;
    const closedResult = { type: 'closed' } as GoogleMapKeyboardSelectionResult;

    // Action
    const selectedValue = service.isKeyboardSelectionSelected(selectedResult);
    const closedValue = service.isKeyboardSelectionSelected(closedResult);

    // Assert
    expect(selectedValue).toBeTrue();
    expect(closedValue).toBeFalse();
  });
});
