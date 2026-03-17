import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from 'src/app/core/i18n/services/i18n.service';
import { PropertyMiniImageCarouselComponent } from 'src/app/core/maps/components/property-mini-image-carousel/property-mini-image-carousel.component';

class PropertyMiniImageCarouselMockFactory {
  static createI18nMock() {
    return {
      get: jasmine
        .createSpy('get')
        .and.callFake((id: string, language: string) => `${id}:${language}`)
    };
  }

  static createComponent(i18nMock: { get: jasmine.Spy }): PropertyMiniImageCarouselComponent {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18nMock }]
    });
    return TestBed.runInInjectionContext(() => new PropertyMiniImageCarouselComponent());
  }

  static createKeyboardEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
      key: '',
      defaultPrevented: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target: null,
      preventDefault: jasmine.createSpy('preventDefault'),
      ...overrides
    } as unknown as KeyboardEvent;
  }
}

describe('PropertyMiniImageCarouselComponent', () => {
  it('ngOnChanges should reset selected image index when images change', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    component.selectedImageIndex = 3;

    // Action
    component.ngOnChanges({
      imageUrls: new SimpleChange(['a'], ['b'], false)
    });

    // Assert
    expect(component.selectedImageIndex).toBe(0);
  });

  it('onWindowKeyDown should ignore prevented events and empty images', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    const prevented = PropertyMiniImageCarouselMockFactory.createKeyboardEvent({
      defaultPrevented: true,
      key: 'ArrowLeft'
    });
    const noImages = PropertyMiniImageCarouselMockFactory.createKeyboardEvent({
      key: 'ArrowRight'
    });

    // Action
    component.onWindowKeyDown(prevented);
    component.onWindowKeyDown(noImages);

    // Assert
    expect(prevented.preventDefault as jasmine.Spy).not.toHaveBeenCalled();
    expect(noImages.preventDefault as jasmine.Spy).not.toHaveBeenCalled();
    expect(component.selectedImageIndex).toBe(0);
  });

  [
    { ctrlKey: true, metaKey: false, altKey: false },
    { ctrlKey: false, metaKey: true, altKey: false },
    { ctrlKey: false, metaKey: false, altKey: true }
  ].forEach((modifierSet) => {
    it(`onWindowKeyDown should ignore event for modifier set ${JSON.stringify(modifierSet)}`, () => {
      // Arrange
      const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
      const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
      component.imageUrls = ['one', 'two'];
      component.selectedImageIndex = 1;
      const event = PropertyMiniImageCarouselMockFactory.createKeyboardEvent({
        ...modifierSet,
        key: 'ArrowLeft'
      });

      // Action
      component.onWindowKeyDown(event);

      // Assert
      expect(event.preventDefault as jasmine.Spy).not.toHaveBeenCalled();
      expect(component.selectedImageIndex).toBe(1);
    });
  });

  [
    { tagName: 'INPUT', isContentEditable: false },
    { tagName: 'TEXTAREA', isContentEditable: false },
    { tagName: 'SELECT', isContentEditable: false },
    { tagName: 'DIV', isContentEditable: true }
  ].forEach(({ tagName, isContentEditable }) => {
    it(`onWindowKeyDown should ignore typing target ${tagName}${isContentEditable ? ' contentEditable' : ''}`, () => {
      // Arrange
      const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
      const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
      component.imageUrls = ['one', 'two'];
      component.selectedImageIndex = 1;
      const event = PropertyMiniImageCarouselMockFactory.createKeyboardEvent({
        key: 'ArrowLeft',
        target: { tagName, isContentEditable } as unknown as HTMLElement
      });

      // Action
      component.onWindowKeyDown(event);

      // Assert
      expect(event.preventDefault as jasmine.Spy).not.toHaveBeenCalled();
      expect(component.selectedImageIndex).toBe(1);
    });
  });

  it('onWindowKeyDown should navigate for left and right keys', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    component.imageUrls = ['one', 'two', 'three'];
    component.selectedImageIndex = 1;
    const left = PropertyMiniImageCarouselMockFactory.createKeyboardEvent({ key: 'ArrowLeft' });
    const right = PropertyMiniImageCarouselMockFactory.createKeyboardEvent({ key: 'ArrowRight' });

    // Action
    component.onWindowKeyDown(left);
    const afterLeft = component.selectedImageIndex;
    component.onWindowKeyDown(right);
    const afterRight = component.selectedImageIndex;

    // Assert
    expect(left.preventDefault as jasmine.Spy).toHaveBeenCalledTimes(1);
    expect(right.preventDefault as jasmine.Spy).toHaveBeenCalledTimes(1);
    expect(afterLeft).toBe(0);
    expect(afterRight).toBe(1);
  });

  it('onWindowKeyDown should ignore other keys', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    component.imageUrls = ['one', 'two'];
    component.selectedImageIndex = 1;
    const event = PropertyMiniImageCarouselMockFactory.createKeyboardEvent({ key: 'KeyA' });

    // Action
    component.onWindowKeyDown(event);

    // Assert
    expect(event.preventDefault as jasmine.Spy).not.toHaveBeenCalled();
    expect(component.selectedImageIndex).toBe(1);
  });

  it('t should resolve translation from i18n service', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    component.selectedLanguage = 'sp';

    // Action
    const result = component.t('map.PROPERTY_MINI_CAROUSEL_NEXT_IMAGE');

    // Assert
    expect(i18nMock.get).toHaveBeenCalledOnceWith('map.PROPERTY_MINI_CAROUSEL_NEXT_IMAGE', 'sp');
    expect(result).toBe('map.PROPERTY_MINI_CAROUSEL_NEXT_IMAGE:sp');
  });

  it('hasImages should reflect image list state', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);

    // Action
    component.imageUrls = [];
    const none = component.hasImages();
    component.imageUrls = ['one'];
    const one = component.hasImages();

    // Assert
    expect(none).toBeFalse();
    expect(one).toBeTrue();
  });

  it('currentImageUrl should return empty for no images and out-of-range index', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);

    // Action
    component.imageUrls = [];
    const noImages = component.currentImageUrl();
    component.imageUrls = ['one'];
    component.selectedImageIndex = 3;
    const outOfRange = component.currentImageUrl();

    // Assert
    expect(noImages).toBe('');
    expect(outOfRange).toBe('');
  });

  it('currentImageUrl should return selected image when index is valid', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    component.imageUrls = ['one', 'two'];
    component.selectedImageIndex = 1;

    // Action
    const result = component.currentImageUrl();

    // Assert
    expect(result).toBe('two');
  });

  it('selectPreviousImage should wrap and ignore empty image list', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    component.imageUrls = [];
    component.selectedImageIndex = 2;

    // Action
    component.selectPreviousImage();
    const emptyResult = component.selectedImageIndex;
    component.imageUrls = ['one', 'two', 'three'];
    component.selectedImageIndex = 0;
    component.selectPreviousImage();
    const wrappedResult = component.selectedImageIndex;

    // Assert
    expect(emptyResult).toBe(2);
    expect(wrappedResult).toBe(2);
  });

  it('selectNextImage should wrap and ignore empty image list', () => {
    // Arrange
    const i18nMock = PropertyMiniImageCarouselMockFactory.createI18nMock();
    const component = PropertyMiniImageCarouselMockFactory.createComponent(i18nMock);
    component.imageUrls = [];
    component.selectedImageIndex = 1;

    // Action
    component.selectNextImage();
    const emptyResult = component.selectedImageIndex;
    component.imageUrls = ['one', 'two', 'three'];
    component.selectedImageIndex = 2;
    component.selectNextImage();
    const wrappedResult = component.selectedImageIndex;

    // Assert
    expect(emptyResult).toBe(1);
    expect(wrappedResult).toBe(0);
  });
});
