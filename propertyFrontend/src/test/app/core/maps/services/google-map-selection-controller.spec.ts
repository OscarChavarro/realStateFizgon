import {
  GoogleMapKeyboardSelectionResult,
  GoogleMapSelectionController
} from 'src/app/core/maps/services/google-map-selection-controller';
import { GoogleMapProperty } from 'src/app/core/maps/model/google-map-property.model';

class GoogleMapSelectionControllerMockFactory {
  static createProperty(overrides: Partial<GoogleMapProperty> = {}): GoogleMapProperty {
    return {
      id: 'property-1',
      propertyId: '1',
      title: 'Property 1',
      price: '1400',
      latitude: 40.4,
      longitude: -3.7,
      review: 'NEW',
      imageUrls: [],
      ...overrides
    };
  }

  static createProperties(): GoogleMapProperty[] {
    return [
      this.createProperty({ id: 'p1', propertyId: '1', title: 'P1' }),
      this.createProperty({ id: 'p2', propertyId: '2', title: 'P2' }),
      this.createProperty({ id: 'p3', propertyId: '3', title: 'P3' })
    ];
  }

  static createKeyboardEvent(
    key: string,
    options: KeyboardEventInit = {},
    target?: HTMLElement
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, ...options });
    if (target) {
      Object.defineProperty(event, 'target', { configurable: true, value: target });
    }
    return event;
  }
}

describe('GoogleMapSelectionController', () => {
  let controller: GoogleMapSelectionController;

  beforeEach(() => {
    controller = new GoogleMapSelectionController();
  });

  it('should expose selected property lifecycle methods', () => {
    // Arrange
    const [first] = GoogleMapSelectionControllerMockFactory.createProperties();

    // Action
    const initialSelected = controller.getSelectedPropertySummary();
    const clearWithoutSelection = controller.clearSelection();
    controller.selectProperty(first);
    const selectedAfterSet = controller.getSelectedPropertySummary();
    const clearWithSelection = controller.clearSelection();
    const selectedAfterClear = controller.getSelectedPropertySummary();

    // Assert
    expect(initialSelected).toBeNull();
    expect(clearWithoutSelection).toBeFalse();
    expect(selectedAfterSet).toEqual(first);
    expect(clearWithSelection).toBeTrue();
    expect(selectedAfterClear).toBeNull();
  });

  it('syncSelectionAgainstProperties should return null when nothing is selected', () => {
    // Arrange
    const properties = GoogleMapSelectionControllerMockFactory.createProperties();

    // Action
    const synced = controller.syncSelectionAgainstProperties(properties);

    // Assert
    expect(synced).toBeNull();
    expect(controller.getSelectedPropertySummary()).toBeNull();
  });

  it('syncSelectionAgainstProperties should keep selection when selected id exists', () => {
    // Arrange
    const properties = GoogleMapSelectionControllerMockFactory.createProperties();
    controller.selectProperty(properties[1]);

    // Action
    const synced = controller.syncSelectionAgainstProperties(properties);

    // Assert
    expect(synced).toEqual(properties[1]);
    expect(controller.getSelectedPropertySummary()).toEqual(properties[1]);
  });

  it('syncSelectionAgainstProperties should clear selection when selected id does not exist', () => {
    // Arrange
    const properties = GoogleMapSelectionControllerMockFactory.createProperties();
    controller.selectProperty(GoogleMapSelectionControllerMockFactory.createProperty({ id: 'missing', propertyId: 'x' }));

    // Action
    const synced = controller.syncSelectionAgainstProperties(properties);

    // Assert
    expect(synced).toBeNull();
    expect(controller.getSelectedPropertySummary()).toBeNull();
  });

  [
    {
      name: 'interaction is disabled',
      event: GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown'),
      interactionEnabled: false
    },
    {
      name: 'event is defaultPrevented',
      event: (() => {
        const keyboardEvent = GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown');
        keyboardEvent.preventDefault();
        return keyboardEvent;
      })(),
      interactionEnabled: true
    },
    {
      name: 'event is repeat',
      event: GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown', { repeat: true }),
      interactionEnabled: true
    },
    {
      name: 'ctrl modifier is pressed',
      event: GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown', { ctrlKey: true }),
      interactionEnabled: true
    },
    {
      name: 'meta modifier is pressed',
      event: GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown', { metaKey: true }),
      interactionEnabled: true
    },
    {
      name: 'alt modifier is pressed',
      event: GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown', { altKey: true }),
      interactionEnabled: true
    }
  ].forEach(({ name, event, interactionEnabled }) => {
    it(`handleKeyboardSelection should return none when ${name}`, () => {
      // Arrange
      const properties = GoogleMapSelectionControllerMockFactory.createProperties();

      // Action
      const result = controller.handleKeyboardSelection(event, interactionEnabled, properties);

      // Assert
      expect(result).toEqual({ type: 'none' });
    });
  });

  [
    { tagName: 'input', setup: (element: HTMLElement) => element },
    { tagName: 'textarea', setup: (element: HTMLElement) => element },
    { tagName: 'select', setup: (element: HTMLElement) => element },
    {
      tagName: 'contenteditable',
      setup: (element: HTMLElement) => {
        element.contentEditable = 'true';
        return element;
      }
    }
  ].forEach(({ tagName, setup }) => {
    it(`handleKeyboardSelection should return none when target is ${tagName}`, () => {
      // Arrange
      const properties = GoogleMapSelectionControllerMockFactory.createProperties();
      const target = setup(document.createElement(tagName === 'contenteditable' ? 'div' : tagName));
      const event = GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown', {}, target);

      // Action
      const result = controller.handleKeyboardSelection(event, true, properties);

      // Assert
      expect(result).toEqual({ type: 'none' });
    });
  });

  it('handleKeyboardSelection should return closed and prevent default on Escape when selection exists', () => {
    // Arrange
    const properties = GoogleMapSelectionControllerMockFactory.createProperties();
    controller.selectProperty(properties[0]);
    const event = GoogleMapSelectionControllerMockFactory.createKeyboardEvent('Escape');

    // Action
    const result = controller.handleKeyboardSelection(event, true, properties);

    // Assert
    expect(result).toEqual({ type: 'closed' });
    expect(event.defaultPrevented).toBeTrue();
    expect(controller.getSelectedPropertySummary()).toBeNull();
  });

  it('handleKeyboardSelection should return none on Escape when there is no selection', () => {
    // Arrange
    const properties = GoogleMapSelectionControllerMockFactory.createProperties();
    const event = GoogleMapSelectionControllerMockFactory.createKeyboardEvent('Escape');

    // Action
    const result = controller.handleKeyboardSelection(event, true, properties);

    // Assert
    expect(result).toEqual({ type: 'none' });
    expect(event.defaultPrevented).toBeFalse();
  });

  it('handleKeyboardSelection should return none for non navigation keys', () => {
    // Arrange
    const properties = GoogleMapSelectionControllerMockFactory.createProperties();
    const event = GoogleMapSelectionControllerMockFactory.createKeyboardEvent('Enter');

    // Action
    const result = controller.handleKeyboardSelection(event, true, properties);

    // Assert
    expect(result).toEqual({ type: 'none' });
  });

  it('handleKeyboardSelection should return none when there are no mappable properties', () => {
    // Arrange
    const event = GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown');

    // Action
    const result = controller.handleKeyboardSelection(event, true, []);

    // Assert
    expect(result).toEqual({ type: 'none' });
    expect(event.defaultPrevented).toBeFalse();
  });

  it('handleKeyboardSelection should return none when selectByKeyboard returns null', () => {
    // Arrange
    const properties = GoogleMapSelectionControllerMockFactory.createProperties();
    const event = GoogleMapSelectionControllerMockFactory.createKeyboardEvent('ArrowDown');
    spyOn<any>(controller, 'selectByKeyboard').and.returnValue(null);

    // Action
    const result = controller.handleKeyboardSelection(event, true, properties);

    // Assert
    expect(result).toEqual({ type: 'none' });
    expect(event.defaultPrevented).toBeTrue();
  });

  [
    {
      key: 'ArrowDown',
      beforeSelect: null,
      expectedId: 'p1'
    },
    {
      key: 'ArrowUp',
      beforeSelect: null,
      expectedId: 'p3'
    },
    {
      key: 'ArrowDown',
      beforeSelect: 'p1',
      expectedId: 'p2'
    },
    {
      key: 'ArrowUp',
      beforeSelect: 'missing',
      expectedId: 'p3'
    }
  ].forEach(({ key, beforeSelect, expectedId }) => {
    it(`handleKeyboardSelection should select ${expectedId} for ${key} with previous selection ${beforeSelect ?? 'none'}`, () => {
      // Arrange
      const properties = GoogleMapSelectionControllerMockFactory.createProperties();
      if (beforeSelect) {
        const selected = properties.find((item) => item.id === beforeSelect)
          ?? GoogleMapSelectionControllerMockFactory.createProperty({ id: beforeSelect, propertyId: beforeSelect });
        controller.selectProperty(selected);
      }
      const event = GoogleMapSelectionControllerMockFactory.createKeyboardEvent(key);

      // Action
      const result = controller.handleKeyboardSelection(event, true, properties) as GoogleMapKeyboardSelectionResult;

      // Assert
      expect(result.type).toBe('selected');
      if (result.type === 'selected') {
        expect(result.property.id).toBe(expectedId);
      }
      expect(event.defaultPrevented).toBeTrue();
    });
  });

  it('private selectByKeyboard should return null when properties are empty', () => {
    // Arrange

    // Action
    const selected = (controller as any).selectByKeyboard(1, []);

    // Assert
    expect(selected).toBeNull();
  });

  it('private isTypingTarget should return false for null target', () => {
    // Arrange

    // Action
    const result = (controller as any).isTypingTarget(null);

    // Assert
    expect(result).toBeFalse();
  });
});
