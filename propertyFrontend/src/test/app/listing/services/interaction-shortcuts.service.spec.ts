import { ListingPropertyRow } from 'src/app/listing/model/listing.types';
import { InteractionShortcutsService } from 'src/app/listing/services/interaction-shortcuts.service';

class InteractionShortcutsMockFactory {
  static createProperty(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'property-1',
      publicationDate: '2026-03-15T00:00:00.000Z',
      publicationDateShort: '2026-03-15',
      title: 'Title',
      url: 'https://example.com/1',
      price: '1200',
      location: 'Madrid',
      advertiserComment: '',
      localImageUrls: [],
      unavailable: false,
      geoLocationHint: null,
      ...overrides
    };
  }

  static createContext(overrides: Partial<any> = {}): any {
    const selectedProperty = this.createProperty();
    return {
      event: new KeyboardEvent('keydown'),
      activeTab: 'DASHBOARD',
      isAuthenticated: true,
      properties: [selectedProperty],
      selectedProperty,
      onKeyboardSelect: jasmine.createSpy('onKeyboardSelect').and.returnValue(selectedProperty),
      onToggleFullscreen: jasmine.createSpy('onToggleFullscreen'),
      onTogglePropertyReview: jasmine.createSpy('onTogglePropertyReview'),
      onTogglePropertyLocationDialog: jasmine.createSpy('onTogglePropertyLocationDialog'),
      onScrollSelectedProperty: jasmine.createSpy('onScrollSelectedProperty'),
      ...overrides
    };
  }

  static createKeyboardEvent(init: KeyboardEventInit & { key?: string; code?: string }): KeyboardEvent {
    const event = new KeyboardEvent('keydown', init);
    return event;
  }
}

describe('InteractionShortcutsService', () => {
  let service: InteractionShortcutsService;

  beforeEach(() => {
    service = new InteractionShortcutsService();
  });

  [
    'INPUT',
    'TEXTAREA',
    'SELECT'
  ].forEach((tagName) => {
    it(`handleWindowKeyDown should ignore typing target ${tagName}`, () => {
      // Arrange
      const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowUp' });
      Object.defineProperty(event, 'target', { value: document.createElement(tagName), configurable: true });
      const context = InteractionShortcutsMockFactory.createContext({ event });

      // Action
      service.handleWindowKeyDown(context);

      // Assert
      expect(context.onKeyboardSelect).not.toHaveBeenCalled();
    });
  });

  it('handleWindowKeyDown should ignore content editable target', () => {
    // Arrange
    const target = document.createElement('div');
    target.contentEditable = 'true';
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowDown' });
    Object.defineProperty(event, 'target', { value: target, configurable: true });
    const context = InteractionShortcutsMockFactory.createContext({ event });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onKeyboardSelect).not.toHaveBeenCalled();
  });

  it('handleWindowKeyDown should ignore Ctrl+F shortcut', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'f', ctrlKey: true });
    const context = InteractionShortcutsMockFactory.createContext({ event });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onToggleFullscreen).not.toHaveBeenCalled();
  });

  it('handleWindowKeyDown should ignore Meta+F shortcut', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'f', metaKey: true });
    const context = InteractionShortcutsMockFactory.createContext({ event });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onToggleFullscreen).not.toHaveBeenCalled();
  });

  it('handleWindowKeyDown should toggle fullscreen on plain f', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'f' });
    const preventDefaultSpy = spyOn(event, 'preventDefault');
    const context = InteractionShortcutsMockFactory.createContext({ event });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(context.onToggleFullscreen).toHaveBeenCalled();
  });

  it('handleWindowKeyDown should ignore plain f when event is repeat', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'f', repeat: true });
    const context = InteractionShortcutsMockFactory.createContext({ event });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onToggleFullscreen).not.toHaveBeenCalled();
  });

  it('handleWindowKeyDown should return when event is repeat after fullscreen checks', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowDown', repeat: true });
    const context = InteractionShortcutsMockFactory.createContext({ event });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onKeyboardSelect).not.toHaveBeenCalled();
  });

  it('handleWindowKeyDown should return when event is default prevented', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowDown' });
    Object.defineProperty(event, 'defaultPrevented', { value: true, configurable: true });
    const context = InteractionShortcutsMockFactory.createContext({ event });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onKeyboardSelect).not.toHaveBeenCalled();
  });

  it('handleWindowKeyDown should handle ArrowUp in dashboard tab', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowUp' });
    const preventDefaultSpy = spyOn(event, 'preventDefault');
    const selected = InteractionShortcutsMockFactory.createProperty({ propertyId: 'selected-up' });
    const context = InteractionShortcutsMockFactory.createContext({
      event,
      onKeyboardSelect: jasmine.createSpy('onKeyboardSelect').and.returnValue(selected)
    });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(context.onKeyboardSelect).toHaveBeenCalledOnceWith(-1);
    expect(context.onScrollSelectedProperty).toHaveBeenCalledOnceWith(selected);
  });

  it('handleWindowKeyDown should skip ArrowUp outside dashboard tab', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowUp' });
    const context = InteractionShortcutsMockFactory.createContext({ event, activeTab: 'MAP_TAB' });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onKeyboardSelect).not.toHaveBeenCalled();
  });

  it('handleWindowKeyDown should handle ArrowDown in dashboard tab', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowDown' });
    const preventDefaultSpy = spyOn(event, 'preventDefault');
    const selected = InteractionShortcutsMockFactory.createProperty({ propertyId: 'selected-down' });
    const context = InteractionShortcutsMockFactory.createContext({
      event,
      onKeyboardSelect: jasmine.createSpy('onKeyboardSelect').and.returnValue(selected)
    });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(context.onKeyboardSelect).toHaveBeenCalledOnceWith(1);
    expect(context.onScrollSelectedProperty).toHaveBeenCalledOnceWith(selected);
  });

  it('handleWindowKeyDown should skip ArrowDown outside dashboard tab', () => {
    // Arrange
    const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'ArrowDown' });
    const context = InteractionShortcutsMockFactory.createContext({ event, activeTab: 'MAP_TAB' });

    // Action
    service.handleWindowKeyDown(context);

    // Assert
    expect(context.onKeyboardSelect).not.toHaveBeenCalled();
  });

  [
    { activeTab: 'MAP_TAB', isAuthenticated: true, selectedProperty: InteractionShortcutsMockFactory.createProperty(), called: false },
    { activeTab: 'DASHBOARD', isAuthenticated: false, selectedProperty: InteractionShortcutsMockFactory.createProperty(), called: false },
    { activeTab: 'DASHBOARD', isAuthenticated: true, selectedProperty: null, called: false },
    { activeTab: 'DASHBOARD', isAuthenticated: true, selectedProperty: InteractionShortcutsMockFactory.createProperty(), called: true }
  ].forEach(({ activeTab, isAuthenticated, selectedProperty, called }) => {
    it(`handleWindowKeyDown should handle Space with expected call=${called}`, () => {
      // Arrange
      const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: ' ', code: 'Space' });
      const preventDefaultSpy = spyOn(event, 'preventDefault');
      const context = InteractionShortcutsMockFactory.createContext({
        event,
        activeTab,
        isAuthenticated,
        selectedProperty
      });

      // Action
      service.handleWindowKeyDown(context);

      // Assert
      expect(context.onTogglePropertyReview.calls.any()).toBe(called);
      expect(preventDefaultSpy.calls.any()).toBe(called);
    });
  });

  [
    { activeTab: 'MAP_TAB', selectedProperty: InteractionShortcutsMockFactory.createProperty(), ctrlKey: false, metaKey: false, altKey: false, called: false },
    { activeTab: 'DASHBOARD', selectedProperty: null, ctrlKey: false, metaKey: false, altKey: false, called: false },
    { activeTab: 'DASHBOARD', selectedProperty: InteractionShortcutsMockFactory.createProperty(), ctrlKey: true, metaKey: false, altKey: false, called: false },
    { activeTab: 'DASHBOARD', selectedProperty: InteractionShortcutsMockFactory.createProperty(), ctrlKey: false, metaKey: true, altKey: false, called: false },
    { activeTab: 'DASHBOARD', selectedProperty: InteractionShortcutsMockFactory.createProperty(), ctrlKey: false, metaKey: false, altKey: true, called: false },
    { activeTab: 'DASHBOARD', selectedProperty: InteractionShortcutsMockFactory.createProperty(), ctrlKey: false, metaKey: false, altKey: false, called: true }
  ].forEach(({ activeTab, selectedProperty, ctrlKey, metaKey, altKey, called }) => {
    it(`handleWindowKeyDown should handle plain m with expected call=${called}`, () => {
      // Arrange
      const event = InteractionShortcutsMockFactory.createKeyboardEvent({ key: 'm', ctrlKey, metaKey, altKey });
      const preventDefaultSpy = spyOn(event, 'preventDefault');
      const context = InteractionShortcutsMockFactory.createContext({
        event,
        activeTab,
        selectedProperty
      });

      // Action
      service.handleWindowKeyDown(context);

      // Assert
      expect(context.onTogglePropertyLocationDialog.calls.any()).toBe(called);
      expect(preventDefaultSpy.calls.any()).toBe(called);
    });
  });

  it('scrollSelectedPropertyRow should return when property is null', () => {
    // Arrange
    const scroller = { scrollPropertyIntoView: jasmine.createSpy('scrollPropertyIntoView') };

    // Action
    service.scrollSelectedPropertyRow(null, scroller);

    // Assert
    expect(scroller.scrollPropertyIntoView).not.toHaveBeenCalled();
  });

  it('scrollSelectedPropertyRow should return when scroller is missing', () => {
    // Arrange
    const property = InteractionShortcutsMockFactory.createProperty();

    // Action
    service.scrollSelectedPropertyRow(property);

    // Assert
    expect().nothing();
  });

  it('scrollSelectedPropertyRow should queue microtask and scroll property', (done) => {
    // Arrange
    const property = InteractionShortcutsMockFactory.createProperty({ propertyId: 'microtask' });
    const scroller = { scrollPropertyIntoView: jasmine.createSpy('scrollPropertyIntoView') };

    // Action
    service.scrollSelectedPropertyRow(property, scroller);
    setTimeout(() => {
      // Assert
      expect(scroller.scrollPropertyIntoView).toHaveBeenCalledOnceWith(property);
      done();
    }, 0);
  });
});
