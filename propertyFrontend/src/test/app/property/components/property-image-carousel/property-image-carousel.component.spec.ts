import { SimpleChange } from '@angular/core';
import { PropertyImageCarouselComponent } from 'src/app/property/components/property-image-carousel/property-image-carousel.component';

class PropertyImageCarouselComponentMockFactory {
  static createComponent(): PropertyImageCarouselComponent {
    return new PropertyImageCarouselComponent();
  }

  static createKeyboardEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
      key: '',
      defaultPrevented: false,
      target: null,
      preventDefault: jasmine.createSpy('preventDefault'),
      ...overrides
    } as unknown as KeyboardEvent;
  }
}

describe('PropertyImageCarouselComponent', () => {
  let requestAnimationFrameSpy: jasmine.Spy;

  beforeEach(() => {
    requestAnimationFrameSpy = spyOn(window, 'requestAnimationFrame')
      .and.callFake((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
  });

  it('ngOnChanges should reset selected image when property or image list changes', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    component.selectedImageIndex = 3;

    // Action
    component.ngOnChanges({
      propertyId: new SimpleChange('old', 'new', false)
    });
    const afterPropertyChange = component.selectedImageIndex;
    component.selectedImageIndex = 2;
    component.ngOnChanges({
      localImageUrls: new SimpleChange(['a'], ['b'], false)
    });
    const afterImagesChange = component.selectedImageIndex;

    // Assert
    expect(afterPropertyChange).toBe(0);
    expect(afterImagesChange).toBe(0);
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2);
  });

  it('onWindowKeyDown should ignore prevented events and empty image list', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    const preventedEvent = PropertyImageCarouselComponentMockFactory.createKeyboardEvent({
      defaultPrevented: true,
      key: 'ArrowLeft'
    });
    const noImagesEvent = PropertyImageCarouselComponentMockFactory.createKeyboardEvent({
      key: 'ArrowRight'
    });

    // Action
    component.onWindowKeyDown(preventedEvent);
    component.onWindowKeyDown(noImagesEvent);

    // Assert
    expect((preventedEvent.preventDefault as jasmine.Spy)).not.toHaveBeenCalled();
    expect((noImagesEvent.preventDefault as jasmine.Spy)).not.toHaveBeenCalled();
    expect(component.selectedImageIndex).toBe(0);
  });

  [
    { tagName: 'INPUT', isContentEditable: false },
    { tagName: 'TEXTAREA', isContentEditable: false },
    { tagName: 'SELECT', isContentEditable: false },
    { tagName: 'DIV', isContentEditable: true }
  ].forEach(({ tagName, isContentEditable }) => {
    it(`onWindowKeyDown should ignore typing target ${tagName}${isContentEditable ? ' contentEditable' : ''}`, () => {
      // Arrange
      const component = PropertyImageCarouselComponentMockFactory.createComponent();
      component.localImageUrls = ['one', 'two'];
      component.selectedImageIndex = 1;
      const event = PropertyImageCarouselComponentMockFactory.createKeyboardEvent({
        key: 'ArrowLeft',
        target: { tagName, isContentEditable } as unknown as HTMLElement
      });

      // Action
      component.onWindowKeyDown(event);

      // Assert
      expect((event.preventDefault as jasmine.Spy)).not.toHaveBeenCalled();
      expect(component.selectedImageIndex).toBe(1);
    });
  });

  it('onWindowKeyDown should move left and right for arrow keys', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    component.localImageUrls = ['one', 'two', 'three'];
    component.selectedImageIndex = 1;
    const leftEvent = PropertyImageCarouselComponentMockFactory.createKeyboardEvent({ key: 'ArrowLeft' });
    const rightEvent = PropertyImageCarouselComponentMockFactory.createKeyboardEvent({ key: 'ArrowRight' });

    // Action
    component.onWindowKeyDown(leftEvent);
    const afterLeft = component.selectedImageIndex;
    component.onWindowKeyDown(rightEvent);
    const afterRight = component.selectedImageIndex;

    // Assert
    expect((leftEvent.preventDefault as jasmine.Spy)).toHaveBeenCalledTimes(1);
    expect((rightEvent.preventDefault as jasmine.Spy)).toHaveBeenCalledTimes(1);
    expect(afterLeft).toBe(0);
    expect(afterRight).toBe(1);
  });

  it('onWindowKeyDown should ignore non-navigation keys', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    component.localImageUrls = ['one', 'two'];
    component.selectedImageIndex = 1;
    const event = PropertyImageCarouselComponentMockFactory.createKeyboardEvent({ key: 'KeyA' });

    // Action
    component.onWindowKeyDown(event);

    // Assert
    expect((event.preventDefault as jasmine.Spy)).not.toHaveBeenCalled();
    expect(component.selectedImageIndex).toBe(1);
  });

  it('selectImage should update index only for valid index', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    component.localImageUrls = ['one', 'two', 'three'];
    component.selectedImageIndex = 1;

    // Action
    component.selectImage(-1);
    const afterNegative = component.selectedImageIndex;
    component.selectImage(3);
    const afterOutOfRange = component.selectedImageIndex;
    component.selectImage(2);
    const afterValid = component.selectedImageIndex;

    // Assert
    expect(afterNegative).toBe(1);
    expect(afterOutOfRange).toBe(1);
    expect(afterValid).toBe(2);
  });

  it('selectPreviousImage should wrap around and ignore empty image list', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    component.localImageUrls = [];
    component.selectedImageIndex = 2;

    // Action
    component.selectPreviousImage();
    const whenEmpty = component.selectedImageIndex;
    component.localImageUrls = ['one', 'two', 'three'];
    component.selectedImageIndex = 0;
    component.selectPreviousImage();
    const wrapped = component.selectedImageIndex;

    // Assert
    expect(whenEmpty).toBe(2);
    expect(wrapped).toBe(2);
  });

  it('selectNextImage should wrap around and ignore empty image list', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    component.localImageUrls = [];
    component.selectedImageIndex = 1;

    // Action
    component.selectNextImage();
    const whenEmpty = component.selectedImageIndex;
    component.localImageUrls = ['one', 'two', 'three'];
    component.selectedImageIndex = 2;
    component.selectNextImage();
    const wrapped = component.selectedImageIndex;

    // Assert
    expect(whenEmpty).toBe(1);
    expect(wrapped).toBe(0);
  });

  it('getSelectedImageSrc should return empty string when no images', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();

    // Action
    const result = component.getSelectedImageSrc();

    // Assert
    expect(result).toBe('');
  });

  it('getSelectedImageSrc should build selected image source', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    component.propertyId = 'p-1';
    component.localImageUrls = ['one.jpg', 'two.jpg'];
    component.selectedImageIndex = 1;
    component.staticMediaBaseUrl = 'http://cdn.local';

    // Action
    const result = component.getSelectedImageSrc();

    // Assert
    expect(result).toBe('http://cdn.local/p-1/two.jpg');
  });

  [
    { baseUrl: 'http://cdn.local', expected: 'http://cdn.local/p-1/image.jpg' },
    { baseUrl: 'http://cdn.local/', expected: 'http://cdn.local/p-1/image.jpg' }
  ].forEach(({ baseUrl, expected }) => {
    it(`buildLocalImageSrc should normalize static media base url "${baseUrl}"`, () => {
      // Arrange
      const component = PropertyImageCarouselComponentMockFactory.createComponent();
      component.propertyId = 'p-1';
      component.staticMediaBaseUrl = baseUrl;

      // Action
      const result = component.buildLocalImageSrc('image.jpg');

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('ensureSelectedThumbnailVisible should scroll to centered thumbnail when strip and target exist', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    const scrollToSpy = jasmine.createSpy('scrollTo');
    component.localImageUrls = ['one'];
    component.thumbnailStrip = {
      nativeElement: {
        clientWidth: 100,
        scrollWidth: 300,
        scrollTo: scrollToSpy
      } as unknown as HTMLDivElement
    } as any;
    component.thumbnailButtons = {
      toArray: () => [
        {
          nativeElement: {
            offsetLeft: 160,
            offsetWidth: 20
          } as unknown as HTMLButtonElement
        }
      ]
    } as any;

    // Action
    component.selectImage(0);

    // Assert
    expect(scrollToSpy).toHaveBeenCalledOnceWith({
      left: 120,
      behavior: 'smooth'
    });
  });

  it('ensureSelectedThumbnailVisible should do nothing when strip or target button are missing', () => {
    // Arrange
    const component = PropertyImageCarouselComponentMockFactory.createComponent();
    const scrollToSpy = jasmine.createSpy('scrollTo');
    component.localImageUrls = ['one'];
    component.thumbnailStrip = {
      nativeElement: {
        clientWidth: 100,
        scrollWidth: 300,
        scrollTo: scrollToSpy
      } as unknown as HTMLDivElement
    } as any;
    component.thumbnailButtons = {
      toArray: () => []
    } as any;

    // Action
    component.selectImage(0);
    (component as any).thumbnailStrip = undefined;
    component.selectImage(0);

    // Assert
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
