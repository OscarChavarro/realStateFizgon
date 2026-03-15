import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ListingFiltersState,
  createDefaultListingFilters
} from 'src/app/listing/model/filters/listing-filters.model';
import { ListingFilterMenuComponent } from 'src/app/listing/components/listing-filter-menu/listing-filter-menu.component';

class ListingFilterMenuMockFactory {
  static createFilters(overrides: Partial<ListingFiltersState> = {}): ListingFiltersState {
    return {
      ...createDefaultListingFilters(),
      ...overrides
    };
  }

  static createMergedFilters(
    base: ListingFiltersState,
    overrides: Partial<ListingFiltersState>
  ): ListingFiltersState {
    return {
      ...base,
      ...overrides
    };
  }

  static createMouseEvent(target: Node | null): MouseEvent {
    return { target } as unknown as MouseEvent;
  }
}

describe('ListingFilterMenuComponent', () => {
  let fixture: ComponentFixture<ListingFilterMenuComponent>;
  let component: ListingFilterMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingFilterMenuComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ListingFilterMenuComponent);
    component = fixture.componentInstance;
    component.filters = ListingFilterMenuMockFactory.createFilters({
      showClosed: false,
      showNew: false,
      showFavourite: false,
      showRejected: false,
      minPublicationDate: '2026-01-10',
      maxPublicationDate: '2026-02-10',
      minPrice: '1200',
      maxPrice: '1500'
    });
  });

  it('should expose expected default values', () => {
    // Arrange
    const defaultComponent = TestBed.createComponent(ListingFilterMenuComponent).componentInstance;

    // Action
    const defaults = {
      selectedLanguage: defaultComponent.selectedLanguage,
      reviewFiltersEnabled: defaultComponent.reviewFiltersEnabled,
      menuOpen: defaultComponent.menuOpen(),
      filters: defaultComponent.filters
    };

    // Assert
    expect(defaults).toEqual({
      selectedLanguage: 'en',
      reviewFiltersEnabled: false,
      menuOpen: false,
      filters: createDefaultListingFilters()
    });
  });

  it('onToggleMenu should toggle menu state', () => {
    // Arrange

    // Action
    component.onToggleMenu();
    const firstValue = component.menuOpen();
    component.onToggleMenu();
    const secondValue = component.menuOpen();

    // Assert
    expect(firstValue).toBeTrue();
    expect(secondValue).toBeFalse();
  });

  [
    { methodName: 'onShowClosedChange', value: true, expectedKey: 'showClosed' as const },
    { methodName: 'onShowNewChange', value: true, expectedKey: 'showNew' as const },
    { methodName: 'onShowFavouriteChange', value: true, expectedKey: 'showFavourite' as const },
    { methodName: 'onShowRejectedChange', value: true, expectedKey: 'showRejected' as const }
  ].forEach(({ methodName, value, expectedKey }) => {
    it(`${methodName} should emit filters with updated ${expectedKey}`, () => {
      // Arrange
      const emitSpy = spyOn(component.filtersChange, 'emit');
      const expected = ListingFilterMenuMockFactory.createMergedFilters(component.filters, {
        [expectedKey]: value
      });

      // Action
      (component as any)[methodName](value);

      // Assert
      expect(emitSpy).toHaveBeenCalledOnceWith(expected);
    });
  });

  [
    {
      methodName: 'onMinPublicationDateChange',
      input: ' 2026-03-01 ',
      expectedKey: 'minPublicationDate' as const,
      expectedValue: '2026-03-01'
    },
    {
      methodName: 'onMaxPublicationDateChange',
      input: '   ',
      expectedKey: 'maxPublicationDate' as const,
      expectedValue: ''
    },
    {
      methodName: 'onMinPublicationDateChange',
      input: 123 as unknown as string,
      expectedKey: 'minPublicationDate' as const,
      expectedValue: ''
    }
  ].forEach(({ methodName, input, expectedKey, expectedValue }) => {
    it(`${methodName} should normalize and emit ${expectedKey}`, () => {
      // Arrange
      const emitSpy = spyOn(component.filtersChange, 'emit');
      const expected = ListingFilterMenuMockFactory.createMergedFilters(component.filters, {
        [expectedKey]: expectedValue
      });

      // Action
      (component as any)[methodName](input);

      // Assert
      expect(emitSpy).toHaveBeenCalledOnceWith(expected);
    });
  });

  [
    {
      methodName: 'onMinPriceChange',
      input: ' €1,499 ',
      expectedKey: 'minPrice' as const,
      expectedValue: '1499'
    },
    {
      methodName: 'onMaxPriceChange',
      input: 'abc',
      expectedKey: 'maxPrice' as const,
      expectedValue: ''
    },
    {
      methodName: 'onMaxPriceChange',
      input: 500 as unknown as string,
      expectedKey: 'maxPrice' as const,
      expectedValue: ''
    }
  ].forEach(({ methodName, input, expectedKey, expectedValue }) => {
    it(`${methodName} should normalize and emit ${expectedKey}`, () => {
      // Arrange
      const emitSpy = spyOn(component.filtersChange, 'emit');
      const expected = ListingFilterMenuMockFactory.createMergedFilters(component.filters, {
        [expectedKey]: expectedValue
      });

      // Action
      (component as any)[methodName](input);

      // Assert
      expect(emitSpy).toHaveBeenCalledOnceWith(expected);
    });
  });

  it('onDocumentClick should keep menu closed when it is already closed', () => {
    // Arrange
    component.menuOpen.set(false);

    // Action
    component.onDocumentClick(
      ListingFilterMenuMockFactory.createMouseEvent(fixture.nativeElement as Node)
    );

    // Assert
    expect(component.menuOpen()).toBeFalse();
  });

  it('onDocumentClick should keep menu open when click happens inside host', () => {
    // Arrange
    component.menuOpen.set(true);

    // Action
    component.onDocumentClick(
      ListingFilterMenuMockFactory.createMouseEvent(fixture.nativeElement as Node)
    );

    // Assert
    expect(component.menuOpen()).toBeTrue();
  });

  it('onDocumentClick should close menu when click happens outside host', () => {
    // Arrange
    component.menuOpen.set(true);
    const outsideTarget = document.createElement('div');

    // Action
    component.onDocumentClick(
      ListingFilterMenuMockFactory.createMouseEvent(outsideTarget)
    );

    // Assert
    expect(component.menuOpen()).toBeFalse();
  });

  it('onDocumentClick should close menu when event target is null', () => {
    // Arrange
    component.menuOpen.set(true);

    // Action
    component.onDocumentClick(
      ListingFilterMenuMockFactory.createMouseEvent(null)
    );

    // Assert
    expect(component.menuOpen()).toBeFalse();
  });

  it('onEscape should close menu', () => {
    // Arrange
    component.menuOpen.set(true);

    // Action
    component.onEscape();

    // Assert
    expect(component.menuOpen()).toBeFalse();
  });

  [
    { language: 'en' as const, key: 'FILTERS' as const, expected: 'Filters' },
    { language: 'sp' as const, key: 'FILTERS' as const, expected: 'Filtros' }
  ].forEach(({ language, key, expected }) => {
    it(`t should return "${expected}" when language is ${language}`, () => {
      // Arrange
      component.selectedLanguage = language;

      // Action
      const translated = component.t(key);

      // Assert
      expect(translated).toBe(expected);
    });
  });
});
