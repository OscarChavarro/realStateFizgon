import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';
import { PropertyLocationComponent } from 'src/app/property/components/property-location/property-location.component';

class PropertyLocationComponentMockFactory {
  static createI18nMock() {
    return {
      get: jasmine
        .createSpy('get')
        .and.callFake((id: string, language: string) => `${id}:${language}`)
    };
  }

  static createGoogleMapMock() {
    return {
      showLayerPanel: jasmine.createSpy('showLayerPanel'),
      toggleLayerPanelVisibility: jasmine.createSpy('toggleLayerPanelVisibility'),
      isLayerPanelOpen: jasmine.createSpy('isLayerPanelOpen').and.returnValue(false)
    };
  }

  static createComponent(i18nMock: { get: jasmine.Spy }): PropertyLocationComponent {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18nMock }]
    });
    return TestBed.runInInjectionContext(() => new PropertyLocationComponent());
  }
}

describe('PropertyLocationComponent', () => {
  beforeEach(() => {
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('ngOnChanges should show layer panel and sync panel state when dialog opens', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    const googleMapMock = PropertyLocationComponentMockFactory.createGoogleMapMock();
    googleMapMock.isLayerPanelOpen.and.returnValue(false);
    (component as any).googleMapComponent = googleMapMock;
    component.isOpen = true;

    // Action
    component.ngOnChanges({
      isOpen: new SimpleChange(false, true, false)
    });
    jasmine.clock().tick(1);

    // Assert
    expect(googleMapMock.showLayerPanel).toHaveBeenCalledTimes(1);
    expect(googleMapMock.isLayerPanelOpen).toHaveBeenCalledTimes(1);
    expect(component.isLayerPanelVisible).toBeFalse();
  });

  it('ngOnChanges should rebuild mapProperties when location-related inputs change', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    component.propertyTitle = 'Property title';
    component.latitude = 40.4;
    component.longitude = -3.7;
    component.isUnavailable = true;

    // Action
    component.ngOnChanges({
      propertyTitle: new SimpleChange('', 'Property title', false),
      latitude: new SimpleChange(null, 40.4, false),
      longitude: new SimpleChange(null, -3.7, false),
      isUnavailable: new SimpleChange(false, true, false)
    });

    // Assert
    expect(component.mapProperties).toEqual([
      {
        id: 'Property title',
        propertyId: '',
        title: 'Property title',
        price: '-',
        latitude: 40.4,
        longitude: -3.7,
        closed: true,
        review: 'NEW',
        imageUrls: []
      }
    ]);
  });

  it('ngOnChanges should build empty mapProperties when coordinates are invalid', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    component.propertyTitle = '';
    component.latitude = Number.NaN;
    component.longitude = -3.7;

    // Action
    component.ngOnChanges({
      latitude: new SimpleChange(10, Number.NaN, false)
    });

    // Assert
    expect(component.mapProperties).toEqual([]);
  });

  it('ngOnChanges should use fallback id and title when propertyTitle is empty', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    component.propertyTitle = '';
    component.latitude = 40.4;
    component.longitude = -3.7;
    component.isUnavailable = false;

    // Action
    component.ngOnChanges({
      latitude: new SimpleChange(null, 40.4, false),
      longitude: new SimpleChange(null, -3.7, false)
    });

    // Assert
    expect(component.mapProperties).toEqual([
      {
        id: 'selected-property',
        propertyId: '',
        title: '-',
        price: '-',
        latitude: 40.4,
        longitude: -3.7,
        closed: false,
        review: 'NEW',
        imageUrls: []
      }
    ]);
  });

  it('ngOnChanges should not trigger open behavior when dialog is not open', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    const googleMapMock = PropertyLocationComponentMockFactory.createGoogleMapMock();
    (component as any).googleMapComponent = googleMapMock;
    component.isOpen = false;

    // Action
    component.ngOnChanges({
      isOpen: new SimpleChange(true, false, false)
    });
    jasmine.clock().tick(1);

    // Assert
    expect(googleMapMock.showLayerPanel).not.toHaveBeenCalled();
    expect(googleMapMock.isLayerPanelOpen).not.toHaveBeenCalled();
  });

  it('onLayerPanelToggleClick should toggle panel and sync state when map exists', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    const googleMapMock = PropertyLocationComponentMockFactory.createGoogleMapMock();
    googleMapMock.isLayerPanelOpen.and.returnValue(true);
    (component as any).googleMapComponent = googleMapMock;

    // Action
    component.onLayerPanelToggleClick();

    // Assert
    expect(googleMapMock.toggleLayerPanelVisibility).toHaveBeenCalledTimes(1);
    expect(googleMapMock.isLayerPanelOpen).toHaveBeenCalledTimes(1);
    expect(component.isLayerPanelVisible).toBeTrue();
  });

  it('onLayerPanelToggleClick should not fail when map component is missing', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    component.isLayerPanelVisible = false;

    // Action
    component.onLayerPanelToggleClick();

    // Assert
    expect(component.isLayerPanelVisible).toBeFalse();
  });

  it('onCloseClick should emit closeRequested event', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    const emitSpy = spyOn(component.closeRequested, 'emit');

    // Action
    component.onCloseClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('onEscapeKey should emit closeRequested only when dialog is open', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    const emitSpy = spyOn(component.closeRequested, 'emit');

    // Action
    component.isOpen = false;
    component.onEscapeKey();
    component.isOpen = true;
    component.onEscapeKey();

    // Assert
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('t should delegate translation lookup', () => {
    // Arrange
    const i18nMock = PropertyLocationComponentMockFactory.createI18nMock();
    const component = PropertyLocationComponentMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.t('PROPERTY_LOCATION_OPEN');

    // Assert
    expect(i18nMock.get).toHaveBeenCalledOnceWith('PROPERTY_LOCATION_OPEN', 'sp');
    expect(result).toBe('PROPERTY_LOCATION_OPEN:sp');
  });
});
