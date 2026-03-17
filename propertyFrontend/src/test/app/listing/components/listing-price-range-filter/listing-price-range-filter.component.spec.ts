import { HttpClient } from '@angular/common/http';
import { SimpleChange, SimpleChanges } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ListingPriceRangeFilterComponent } from 'src/app/listing/components/listing-price-range-filter/listing-price-range-filter.component';

type PriceRangeResponse = {
  minPrice?: unknown;
  maxPrice?: unknown;
};

class ListingPriceRangeFilterHttpClientMock {
  private response$: Observable<PriceRangeResponse> = of({ minPrice: 100, maxPrice: 1000 });
  readonly getCalls: string[] = [];

  setSuccess(response: PriceRangeResponse): void {
    this.response$ = of(response);
  }

  setError(error: unknown = new Error('network-error')): void {
    this.response$ = throwError(() => error);
  }

  get<T>(url: string): Observable<T> {
    this.getCalls.push(url);
    return this.response$ as Observable<T>;
  }

  reset(): void {
    this.getCalls.length = 0;
    this.response$ = of({ minPrice: 100, maxPrice: 1000 });
  }
}

class ListingPriceRangeFilterStateFactory {
  static resetCachedRange(): void {
    (
      ListingPriceRangeFilterComponent as unknown as { cachedPriceRange: unknown }
    ).cachedPriceRange = null;
  }

  static setCachedRange(range: { minPrice: number; maxPrice: number } | null): void {
    (
      ListingPriceRangeFilterComponent as unknown as { cachedPriceRange: unknown }
    ).cachedPriceRange = range;
  }

  static configureRange(
    component: ListingPriceRangeFilterComponent,
    state: {
      hasRange: boolean;
      absoluteMinPrice: number;
      absoluteMaxPrice: number;
      sliderMinPrice: number;
      sliderMaxPrice: number;
    }
  ): void {
    component.hasRange.set(state.hasRange);
    component.absoluteMinPrice.set(state.absoluteMinPrice);
    component.absoluteMaxPrice.set(state.absoluteMaxPrice);
    component.sliderMinPrice.set(state.sliderMinPrice);
    component.sliderMaxPrice.set(state.sliderMaxPrice);
  }

  static createChanges(
    changes: Partial<Record<'minPrice' | 'maxPrice', [string, string]>>
  ): SimpleChanges {
    const result: SimpleChanges = {};
    if (changes.minPrice) {
      result['minPrice'] = new SimpleChange(changes.minPrice[0], changes.minPrice[1], false);
    }
    if (changes.maxPrice) {
      result['maxPrice'] = new SimpleChange(changes.maxPrice[0], changes.maxPrice[1], false);
    }
    return result;
  }
}

describe('ListingPriceRangeFilterComponent', () => {
  let fixture: ComponentFixture<ListingPriceRangeFilterComponent>;
  let component: ListingPriceRangeFilterComponent;
  let httpClientMock: ListingPriceRangeFilterHttpClientMock;

  beforeEach(async () => {
    ListingPriceRangeFilterStateFactory.resetCachedRange();
    httpClientMock = new ListingPriceRangeFilterHttpClientMock();

    await TestBed.configureTestingModule({
      imports: [ListingPriceRangeFilterComponent],
      providers: [{ provide: HttpClient, useValue: httpClientMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(ListingPriceRangeFilterComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    ListingPriceRangeFilterStateFactory.resetCachedRange();
    httpClientMock.reset();
  });

  it('ngOnInit should call loadPriceRange', () => {
    // Arrange
    const loadSpy = spyOn<any>(component, 'loadPriceRange').and.returnValue(Promise.resolve());

    // Action
    component.ngOnInit();

    // Assert
    expect(loadSpy).toHaveBeenCalled();
  });

  [
    {
      changes: ListingPriceRangeFilterStateFactory.createChanges({ minPrice: ['', '10'] }),
      expectedCalls: 1
    },
    {
      changes: ListingPriceRangeFilterStateFactory.createChanges({ maxPrice: ['', '99'] }),
      expectedCalls: 1
    },
    { changes: {} as SimpleChanges, expectedCalls: 0 }
  ].forEach(({ changes, expectedCalls }) => {
    it(`ngOnChanges should call syncSliderRangeWithInputs ${expectedCalls} times for changes set`, () => {
      // Arrange
      const syncSpy = spyOn<any>(component, 'syncSliderRangeWithInputs');

      // Action
      component.ngOnChanges(changes);

      // Assert
      expect(syncSpy.calls.count()).toBe(expectedCalls);
    });
  });

  [
    { rawValue: '1a2b3', expected: '123' },
    { rawValue: 'abc', expected: '' }
  ].forEach(({ rawValue, expected }) => {
    it(`onMinPriceTextInput without range should emit normalized value "${expected}"`, () => {
      // Arrange
      component.hasRange.set(false);
      const emitSpy = spyOn(component.minPriceChange, 'emit');

      // Action
      component.onMinPriceTextInput(rawValue);

      // Assert
      expect(emitSpy).toHaveBeenCalledOnceWith(expected);
    });
  });

  [
    { rawValue: '9a8b7', expected: '987' },
    { rawValue: '---', expected: '' }
  ].forEach(({ rawValue, expected }) => {
    it(`onMaxPriceTextInput without range should emit normalized value "${expected}"`, () => {
      // Arrange
      component.hasRange.set(false);
      const emitSpy = spyOn(component.maxPriceChange, 'emit');

      // Action
      component.onMaxPriceTextInput(rawValue);

      // Assert
      expect(emitSpy).toHaveBeenCalledOnceWith(expected);
    });
  });

  it('onMinPriceTextInput with empty normalized value should reset slider min to absolute min', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 120,
      absoluteMaxPrice: 900,
      sliderMinPrice: 300,
      sliderMaxPrice: 500
    });
    const emitSpy = spyOn(component.minPriceChange, 'emit');

    // Action
    component.onMinPriceTextInput('x');

    // Assert
    expect(component.sliderMinPrice()).toBe(120);
    expect(emitSpy).toHaveBeenCalledOnceWith('');
  });

  it('onMinPriceTextInput with numeric value should clamp and bound by slider max', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 100,
      absoluteMaxPrice: 600,
      sliderMinPrice: 150,
      sliderMaxPrice: 300
    });
    const emitSpy = spyOn(component.minPriceChange, 'emit');

    // Action
    component.onMinPriceTextInput('900');

    // Assert
    expect(component.sliderMinPrice()).toBe(300);
    expect(emitSpy).toHaveBeenCalledOnceWith('300');
  });

  it('onMaxPriceTextInput with empty normalized value should reset slider max to absolute max', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 120,
      absoluteMaxPrice: 900,
      sliderMinPrice: 300,
      sliderMaxPrice: 500
    });
    const emitSpy = spyOn(component.maxPriceChange, 'emit');

    // Action
    component.onMaxPriceTextInput('x');

    // Assert
    expect(component.sliderMaxPrice()).toBe(900);
    expect(emitSpy).toHaveBeenCalledOnceWith('');
  });

  it('onMaxPriceTextInput with numeric value should clamp and bound by slider min', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 100,
      absoluteMaxPrice: 800,
      sliderMinPrice: 350,
      sliderMaxPrice: 700
    });
    const emitSpy = spyOn(component.maxPriceChange, 'emit');

    // Action
    component.onMaxPriceTextInput('250');

    // Assert
    expect(component.sliderMaxPrice()).toBe(350);
    expect(emitSpy).toHaveBeenCalledOnceWith('350');
  });

  it('onMinSliderInput without range should not emit value', () => {
    // Arrange
    component.hasRange.set(false);
    const emitSpy = spyOn(component.minPriceChange, 'emit');

    // Action
    component.onMinSliderInput('200');

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('onMinSliderInput with range should parse, clamp and emit min value', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 100,
      absoluteMaxPrice: 700,
      sliderMinPrice: 150,
      sliderMaxPrice: 300
    });
    const emitSpy = spyOn(component.minPriceChange, 'emit');

    // Action
    component.onMinSliderInput('999');

    // Assert
    expect(component.sliderMinPrice()).toBe(300);
    expect(emitSpy).toHaveBeenCalledOnceWith('300');
  });

  it('onMaxSliderInput without range should not emit value', () => {
    // Arrange
    component.hasRange.set(false);
    const emitSpy = spyOn(component.maxPriceChange, 'emit');

    // Action
    component.onMaxSliderInput('500');

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('onMaxSliderInput with invalid value should fallback and emit max value', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 100,
      absoluteMaxPrice: 700,
      sliderMinPrice: 150,
      sliderMaxPrice: 300
    });
    const emitSpy = spyOn(component.maxPriceChange, 'emit');

    // Action
    component.onMaxSliderInput('invalid');

    // Assert
    expect(component.sliderMaxPrice()).toBe(700);
    expect(emitSpy).toHaveBeenCalledOnceWith('700');
  });

  [
    { hasRange: false, expected: '' },
    { hasRange: true, expected: 'left: 12.5%; width: 37.5%;' }
  ].forEach(({ hasRange, expected }) => {
    it(`getSelectedRangeStyle should return "${expected}" when hasRange is ${hasRange}`, () => {
      // Arrange
      ListingPriceRangeFilterStateFactory.configureRange(component, {
        hasRange,
        absoluteMinPrice: 100,
        absoluteMaxPrice: 500,
        sliderMinPrice: 150,
        sliderMaxPrice: 300
      });

      // Action
      const style = component.getSelectedRangeStyle();

      // Assert
      expect(style).toBe(expected);
    });
  });

  [
    { language: 'en' as const, key: 'MIN_PRICE' as const, expected: 'Min price' },
    { language: 'sp' as const, key: 'MIN_PRICE' as const, expected: 'Precio mínimo' }
  ].forEach(({ language, key, expected }) => {
    it(`t should return translation in ${language}`, () => {
      // Arrange
      component.selectedLanguage = language;

      // Action
      const translated = component.t(key);

      // Assert
      expect(translated).toBe(expected);
    });
  });

  it('loadPriceRange should use cached range and skip HTTP call', async () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.setCachedRange({ minPrice: 222, maxPrice: 888 });
    const applySpy = spyOn<any>(component, 'applyPriceRange').and.callThrough();

    // Action
    await (component as any).loadPriceRange();

    // Assert
    expect(applySpy).toHaveBeenCalledOnceWith({ minPrice: 222, maxPrice: 888 });
    expect(httpClientMock.getCalls.length).toBe(0);
    expect(component.hasRange()).toBeTrue();
    expect(component.loading()).toBeFalse();
  });

  it('loadPriceRange should load and apply valid HTTP range', async () => {
    // Arrange
    component.minPrice = '200';
    component.maxPrice = '300';
    httpClientMock.setSuccess({ minPrice: 120.4, maxPrice: 450.6 });

    // Action
    await (component as any).loadPriceRange();

    // Assert
    expect(httpClientMock.getCalls).toEqual(['/properties/getPriceRanges']);
    expect(component.hasRange()).toBeTrue();
    expect(component.absoluteMinPrice()).toBe(120);
    expect(component.absoluteMaxPrice()).toBe(451);
    expect(component.sliderMinPrice()).toBe(200);
    expect(component.sliderMaxPrice()).toBe(300);
    expect(component.loading()).toBeFalse();
  });

  [
    { response: { minPrice: 'invalid', maxPrice: 400 }, title: 'invalid min' },
    { response: { minPrice: 100, maxPrice: Infinity }, title: 'invalid max' },
    { response: { minPrice: 600, maxPrice: 400 }, title: 'reversed bounds' }
  ].forEach(({ response, title }) => {
    it(`loadPriceRange should mark range unavailable for ${title}`, async () => {
      // Arrange
      httpClientMock.setSuccess(response);

      // Action
      await (component as any).loadPriceRange();

      // Assert
      expect(component.hasRange()).toBeFalse();
      expect(component.loading()).toBeFalse();
    });
  });

  it('loadPriceRange should mark range unavailable on HTTP error', async () => {
    // Arrange
    httpClientMock.setError(new Error('backend-down'));

    // Action
    await (component as any).loadPriceRange();

    // Assert
    expect(component.hasRange()).toBeFalse();
    expect(component.loading()).toBeFalse();
  });

  it('syncSliderRangeWithInputs should stop when range is unavailable', () => {
    // Arrange
    component.hasRange.set(false);
    component.sliderMinPrice.set(111);
    component.sliderMaxPrice.set(999);

    // Action
    (component as any).syncSliderRangeWithInputs();

    // Assert
    expect(component.sliderMinPrice()).toBe(111);
    expect(component.sliderMaxPrice()).toBe(999);
  });

  it('syncSliderRangeWithInputs should align max to min when min is higher and min input is present', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 100,
      absoluteMaxPrice: 500,
      sliderMinPrice: 100,
      sliderMaxPrice: 500
    });
    component.minPrice = '450';
    component.maxPrice = '200';

    // Action
    (component as any).syncSliderRangeWithInputs();

    // Assert
    expect(component.sliderMinPrice()).toBe(450);
    expect(component.sliderMaxPrice()).toBe(450);
  });

  it('syncSliderRangeWithInputs should align min to max when min is higher and min input is empty', () => {
    // Arrange
    ListingPriceRangeFilterStateFactory.configureRange(component, {
      hasRange: true,
      absoluteMinPrice: 100,
      absoluteMaxPrice: 500,
      sliderMinPrice: 100,
      sliderMaxPrice: 500
    });
    component.minPrice = '   ';
    component.maxPrice = '200';
    spyOn<any>(component, 'parsePriceOrFallback').and.returnValues(400, 200);
    spyOn<any>(component, 'clampToAbsoluteRange').and.callFake((value: number) => value);

    // Action
    (component as any).syncSliderRangeWithInputs();

    // Assert
    expect(component.sliderMinPrice()).toBe(200);
    expect(component.sliderMaxPrice()).toBe(200);
  });

  [
    { value: '', fallback: 100, expected: 100 },
    { value: ' 2a5 ', fallback: 100, expected: 25 }
  ].forEach(({ value, fallback, expected }) => {
    it(`parsePriceOrFallback should return ${expected} for "${value}"`, () => {
      // Arrange
      const privateComponent = component as any;

      // Action
      const parsed = privateComponent.parsePriceOrFallback(value, fallback);

      // Assert
      expect(parsed).toBe(expected);
    });
  });

  [
    { rawValue: '260', fallback: 100, expected: 260 },
    { rawValue: 'abc', fallback: 123, expected: 123 }
  ].forEach(({ rawValue, fallback, expected }) => {
    it(`parseSliderValue should return ${expected} for "${rawValue}"`, () => {
      // Arrange
      ListingPriceRangeFilterStateFactory.configureRange(component, {
        hasRange: true,
        absoluteMinPrice: 100,
        absoluteMaxPrice: 500,
        sliderMinPrice: 100,
        sliderMaxPrice: 500
      });
      const privateComponent = component as any;

      // Action
      const parsed = privateComponent.parseSliderValue(rawValue, fallback);

      // Assert
      expect(parsed).toBe(expected);
    });
  });

  [
    { value: 50, expected: 100 },
    { value: 750, expected: 500 }
  ].forEach(({ value, expected }) => {
    it(`clampToAbsoluteRange should return ${expected} for value ${value}`, () => {
      // Arrange
      ListingPriceRangeFilterStateFactory.configureRange(component, {
        hasRange: true,
        absoluteMinPrice: 100,
        absoluteMaxPrice: 500,
        sliderMinPrice: 100,
        sliderMaxPrice: 500
      });
      const privateComponent = component as any;

      // Action
      const clamped = privateComponent.clampToAbsoluteRange(value);

      // Assert
      expect(clamped).toBe(expected);
    });
  });

  [
    { value: '$ 1,250', expected: '1250' },
    { value: 42 as unknown as string, expected: '' }
  ].forEach(({ value, expected }) => {
    it(`normalizeIntegerInput should return "${expected}"`, () => {
      // Arrange
      const privateComponent = component as any;

      // Action
      const normalized = privateComponent.normalizeIntegerInput(value);

      // Assert
      expect(normalized).toBe(expected);
    });
  });

  [
    { value: 123.4, expected: 123 },
    { value: Infinity, expected: null },
    { value: '123', expected: null }
  ].forEach(({ value, expected }) => {
    it(`toIntegerOrNull should return ${expected} for value ${String(value)}`, () => {
      // Arrange
      const privateComponent = component as any;

      // Action
      const result = privateComponent.toIntegerOrNull(value);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
