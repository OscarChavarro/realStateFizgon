import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ListingPropertyRow,
  PropertyLabelEntry,
  SortCriterion,
  SortField
} from 'src/app/listing/model/listing.types';
import { ListingPropertiesTableComponent } from 'src/app/listing/components/listing-properties-table/listing-properties-table.component';

class ListingPropertiesTableMockFactory {
  static createProperty(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'property-1',
      publicationDate: '2026-03-15T10:00:00.000Z',
      publicationDateShort: '2026-03-15',
      title: 'Main Street 123',
      url: 'https://example.com/property-1',
      price: '1500',
      location: 'Madrid',
      advertiserComment: 'Great property',
      localImageUrls: [],
      unavailable: false,
      geoLocationHint: null,
      ...overrides
    };
  }

  static createSortCriteria(
    criteria: Array<{ sortBy: SortField; sortOrder: 'asc' | 'desc' }>
  ): SortCriterion[] {
    return criteria.map((item) => ({ ...item }));
  }

  static createPropertyLabels(
    labels: Array<{ propertyId: string; review?: string }>
  ): PropertyLabelEntry[] {
    return labels.map((item) => ({
      propertyId: item.propertyId,
      labels: item.review ? ({ review: item.review } as PropertyLabelEntry['labels']) : {}
    }));
  }

  static createMouseEventWithStopPropagation(): {
    event: MouseEvent;
    stopPropagationSpy: jasmine.Spy;
  } {
    const stopPropagationSpy = jasmine.createSpy('stopPropagation');
    const event = { stopPropagation: stopPropagationSpy } as unknown as MouseEvent;
    return { event, stopPropagationSpy };
  }

  static attachScrollContainer(
    component: ListingPropertiesTableComponent,
    params: {
      rows: Array<{ rowKey: string; offsetTop: number; offsetHeight: number }>;
      scrollTop: number;
      clientHeight: number;
      headerHeight: number;
      includeHeader?: boolean;
    }
  ): jasmine.Spy {
    const container = document.createElement('div');
    container.className = 'spreadsheet-table-scroll';
    const scrollToSpy = jasmine.createSpy('scrollTo');
    (container as any).scrollTo = scrollToSpy;

    Object.defineProperty(container, 'scrollTop', {
      value: params.scrollTop,
      writable: true,
      configurable: true
    });
    Object.defineProperty(container, 'clientHeight', {
      value: params.clientHeight,
      configurable: true
    });

    const table = document.createElement('table');
    if (params.includeHeader !== false) {
      const thead = document.createElement('thead');
      Object.defineProperty(thead, 'clientHeight', {
        value: params.headerHeight,
        configurable: true
      });
      table.appendChild(thead);
    }
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    for (const rowConfig of params.rows) {
      const row = document.createElement('tr');
      row.className = 'property-row';
      row.dataset['rowKey'] = rowConfig.rowKey;
      Object.defineProperty(row, 'offsetTop', {
        value: rowConfig.offsetTop,
        configurable: true
      });
      Object.defineProperty(row, 'offsetHeight', {
        value: rowConfig.offsetHeight,
        configurable: true
      });
      tbody.appendChild(row);
    }

    container.appendChild(table);
    (component as any).tableWrapperContainer = {
      nativeElement: {
        querySelector: (selector: string) =>
          selector === '.spreadsheet-table-scroll' ? container : null
      }
    };

    return scrollToSpy;
  }
}

describe('ListingPropertiesTableComponent', () => {
  let fixture: ComponentFixture<ListingPropertiesTableComponent>;
  let component: ListingPropertiesTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingPropertiesTableComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ListingPropertiesTableComponent);
    component = fixture.componentInstance;
  });

  it('onSortToggle should emit sort request', () => {
    // Arrange
    const emitSpy = spyOn(component.sortToggle, 'emit');

    // Action
    component.onSortToggle('title');

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith({ sortBy: 'title' });
  });

  it('onPropertyHover should emit hovered property', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'hover-id' });
    const emitSpy = spyOn(component.propertyHover, 'emit');

    // Action
    component.onPropertyHover(property);

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(property);
  });

  it('onPropertyClick should emit selected property', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'click-id' });
    const emitSpy = spyOn(component.propertySelect, 'emit');

    // Action
    component.onPropertyClick(property);

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(property);
  });

  it('onPropertyReviewCellClick should stop propagation and emit property', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'review-id' });
    const { event, stopPropagationSpy } =
      ListingPropertiesTableMockFactory.createMouseEventWithStopPropagation();
    const emitSpy = spyOn(component.propertyReviewToggle, 'emit');

    // Action
    component.onPropertyReviewCellClick(event, property);

    // Assert
    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledOnceWith(property);
  });

  it('onPageChange should emit page number', () => {
    // Arrange
    const emitSpy = spyOn(component.pageChange, 'emit');

    // Action
    component.onPageChange(7);

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(7);
  });

  it('onPageSizeChange should emit page size', () => {
    // Arrange
    const emitSpy = spyOn(component.pageSizeChange, 'emit');

    // Action
    component.onPageSizeChange(500);

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(500);
  });

  [
    { page: 2.9, pageSize: 10.7, rowIndex: 1, expected: 12 },
    { page: 0, pageSize: 0, rowIndex: 0, expected: 1 }
  ].forEach(({ page, pageSize, rowIndex, expected }) => {
    it(`getDisplayRowIndex should return ${expected} for page ${page} and pageSize ${pageSize}`, () => {
      // Arrange
      component.page = page;
      component.pageSize = pageSize;

      // Action
      const result = component.getDisplayRowIndex(rowIndex);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('isPropertyRowLocked should return true when keys match', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'locked-id' });
    const expectedKey = component.trackProperty(0, property);
    component.lockedRowKey = expectedKey;

    // Action
    const result = component.isPropertyRowLocked(property);

    // Assert
    expect(result).toBeTrue();
  });

  it('isPropertyRowLocked should return false when keys differ', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({
      propertyId: 'unlocked-id'
    });
    component.lockedRowKey = 'different-key';

    // Action
    const result = component.isPropertyRowLocked(property);

    // Assert
    expect(result).toBeFalse();
  });

  [
    {
      sortCriteria: [{ sortBy: 'title', sortOrder: 'asc' }],
      sortBy: 'title' as const,
      expected: 'asc' as const
    },
    {
      sortCriteria: [{ sortBy: 'title', sortOrder: 'asc' }],
      sortBy: 'price' as const,
      expected: null
    }
  ].forEach(({ sortCriteria, sortBy, expected }) => {
    it(`getSortDirection should return ${String(expected)} for ${sortBy}`, () => {
      // Arrange
      component.sortCriteria = ListingPropertiesTableMockFactory.createSortCriteria(
        sortCriteria as any
      );

      // Action
      const direction = component.getSortDirection(sortBy);

      // Assert
      expect(direction).toBe(expected);
    });
  });

  [
    {
      sortCriteria: [{ sortBy: 'title', sortOrder: 'asc' }],
      sortBy: 'title' as const,
      expected: 'arrow_upward'
    },
    {
      sortCriteria: [{ sortBy: 'title', sortOrder: 'desc' }],
      sortBy: 'title' as const,
      expected: 'arrow_downward'
    },
    { sortCriteria: [], sortBy: 'title' as const, expected: 'swap_vert' }
  ].forEach(({ sortCriteria, sortBy, expected }) => {
    it(`getSortIcon should return ${expected}`, () => {
      // Arrange
      component.sortCriteria = ListingPropertiesTableMockFactory.createSortCriteria(
        sortCriteria as any
      );

      // Action
      const icon = component.getSortIcon(sortBy);

      // Assert
      expect(icon).toBe(expected);
    });
  });

  [
    {
      sortCriteria: [{ sortBy: 'title', sortOrder: 'asc' }],
      sortBy: 'title' as const,
      expected: 'Sort descending Title'
    },
    {
      sortCriteria: [{ sortBy: 'publicationDate', sortOrder: 'desc' }],
      sortBy: 'publicationDate' as const,
      expected: 'Disable sorting Published on'
    },
    {
      sortCriteria: [],
      sortBy: 'price' as const,
      expected: 'Sort ascending Price (€/month)'
    }
  ].forEach(({ sortCriteria, sortBy, expected }) => {
    it(`getSortAriaLabel should return "${expected}"`, () => {
      // Arrange
      component.sortCriteria = ListingPropertiesTableMockFactory.createSortCriteria(
        sortCriteria as any
      );
      component.selectedLanguage = 'en';

      // Action
      const label = component.getSortAriaLabel(sortBy);

      // Assert
      expect(label).toBe(expected);
    });
  });

  [
    {
      sortCriteria: [
        { sortBy: 'price', sortOrder: 'asc' },
        { sortBy: 'title', sortOrder: 'desc' }
      ],
      sortBy: 'title' as const,
      expected: 2
    },
    {
      sortCriteria: [{ sortBy: 'price', sortOrder: 'asc' }],
      sortBy: 'title' as const,
      expected: null
    }
  ].forEach(({ sortCriteria, sortBy, expected }) => {
    it(`getSortPriority should return ${String(expected)} for ${sortBy}`, () => {
      // Arrange
      component.sortCriteria = ListingPropertiesTableMockFactory.createSortCriteria(
        sortCriteria as any
      );

      // Action
      const priority = component.getSortPriority(sortBy);

      // Assert
      expect(priority).toBe(expected);
    });
  });

  [
    {
      sortCriteria: [
        { sortBy: 'price', sortOrder: 'asc' },
        { sortBy: 'title', sortOrder: 'desc' }
      ],
      sortBy: 'title' as const,
      expected: true
    },
    {
      sortCriteria: [{ sortBy: 'title', sortOrder: 'asc' }],
      sortBy: 'title' as const,
      expected: false
    },
    {
      sortCriteria: [
        { sortBy: 'price', sortOrder: 'asc' },
        { sortBy: 'title', sortOrder: 'desc' }
      ],
      sortBy: 'publicationDate' as const,
      expected: false
    }
  ].forEach(({ sortCriteria, sortBy, expected }) => {
    it(`shouldShowSortPriority should be ${expected} for ${sortBy}`, () => {
      // Arrange
      component.sortCriteria = ListingPropertiesTableMockFactory.createSortCriteria(
        sortCriteria as any
      );

      // Action
      const result = component.shouldShowSortPriority(sortBy);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('trackProperty should return deterministic row key', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({
      propertyId: 'id-77',
      url: 'https://example.com/77',
      publicationDate: '2026-01-01',
      title: 'Sample title'
    });

    // Action
    const rowKey = component.trackProperty(0, property);

    // Assert
    expect(rowKey).toBe('id-77|https://example.com/77|2026-01-01|Sample title');
  });

  it('scrollPropertyIntoView should return when container does not exist', () => {
    // Arrange
    (component as any).tableWrapperContainer = undefined;
    const property = ListingPropertiesTableMockFactory.createProperty();

    // Action
    component.scrollPropertyIntoView(property);

    // Assert
    expect().nothing();
  });

  it('scrollPropertyIntoView should return when target row is not found', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'target-id' });
    ListingPropertiesTableMockFactory.attachScrollContainer(component, {
      rows: [{ rowKey: 'another-key', offsetTop: 100, offsetHeight: 30 }],
      scrollTop: 0,
      clientHeight: 200,
      headerHeight: 30
    });

    // Action
    component.scrollPropertyIntoView(property);

    // Assert
    const wrapper = (component as any).tableWrapperContainer;
    const container = wrapper.nativeElement.querySelector('.spreadsheet-table-scroll') as any;
    expect(container.scrollTo).not.toHaveBeenCalled();
  });

  [
    {
      title: 'row above effective top',
      rowTop: 10,
      rowHeight: 20,
      scrollTop: 50,
      clientHeight: 220,
      headerHeight: 30,
      expectedTop: 0
    },
    {
      title: 'row below viewport bottom',
      rowTop: 330,
      rowHeight: 90,
      scrollTop: 100,
      clientHeight: 250,
      headerHeight: 20,
      expectedTop: 310
    }
  ].forEach(({ title, rowTop, rowHeight, scrollTop, clientHeight, headerHeight, expectedTop }) => {
    it(`scrollPropertyIntoView should scroll when ${title}`, () => {
      // Arrange
      const property = ListingPropertiesTableMockFactory.createProperty({
        propertyId: 'scroll-id'
      });
      const rowKey = component.trackProperty(0, property);
      const scrollToSpy = ListingPropertiesTableMockFactory.attachScrollContainer(component, {
        rows: [{ rowKey, offsetTop: rowTop, offsetHeight: rowHeight }],
        scrollTop,
        clientHeight,
        headerHeight
      });

      // Action
      component.scrollPropertyIntoView(property);

      // Assert
      expect(scrollToSpy).toHaveBeenCalledOnceWith({
        top: expectedTop,
        behavior: 'auto'
      });
    });
  });

  it('scrollPropertyIntoView should scroll when row is deep in viewport', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'deep-row' });
    const rowKey = component.trackProperty(0, property);
    const scrollToSpy = ListingPropertiesTableMockFactory.attachScrollContainer(component, {
      rows: [{ rowKey, offsetTop: 340, offsetHeight: 40 }],
      scrollTop: 100,
      clientHeight: 300,
      headerHeight: 20
    });

    // Action
    component.scrollPropertyIntoView(property);

    // Assert
    expect(scrollToSpy).toHaveBeenCalledOnceWith({
      top: 320,
      behavior: 'auto'
    });
  });

  it('scrollPropertyIntoView should not scroll when row is already in focus area', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({
      propertyId: 'focused-row'
    });
    const rowKey = component.trackProperty(0, property);
    const scrollToSpy = ListingPropertiesTableMockFactory.attachScrollContainer(component, {
      rows: [{ rowKey, offsetTop: 250, offsetHeight: 40 }],
      scrollTop: 100,
      clientHeight: 300,
      headerHeight: 20
    });

    // Action
    component.scrollPropertyIntoView(property);

    // Assert
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('scrollPropertyIntoView should fallback header height to zero when table header is missing', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({
      propertyId: 'no-header-row'
    });
    const rowKey = component.trackProperty(0, property);
    const scrollToSpy = ListingPropertiesTableMockFactory.attachScrollContainer(component, {
      rows: [{ rowKey, offsetTop: 20, offsetHeight: 30 }],
      scrollTop: 0,
      clientHeight: 200,
      headerHeight: 20,
      includeHeader: false
    });

    // Action
    component.scrollPropertyIntoView(property);

    // Assert
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  [
    {
      labels: [{ propertyId: 'p-1', review: 'FAVOURITE' }],
      expectedClass: 'favourite',
      expectedIcon: 'check'
    },
    {
      labels: [{ propertyId: 'p-1', review: 'DISCHARGED' }],
      expectedClass: 'discharged',
      expectedIcon: 'close'
    },
    {
      labels: [{ propertyId: 'p-1', review: 'NEW' }],
      expectedClass: 'new',
      expectedIcon: 'flare'
    },
    {
      labels: [{ propertyId: 'p-1', review: 'UNKNOWN_VALUE' }],
      expectedClass: 'new',
      expectedIcon: 'flare'
    }
  ].forEach(({ labels, expectedClass, expectedIcon }) => {
    it(`review helpers should return class "${expectedClass}" and icon "${expectedIcon}"`, () => {
      // Arrange
      const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'p-1' });
      component.propertyLabels = ListingPropertiesTableMockFactory.createPropertyLabels(
        labels as any
      );

      // Action
      const reviewClass = component.getReviewClass(property);
      const reviewIcon = component.getReviewIcon(property);

      // Assert
      expect(reviewClass).toBe(expectedClass);
      expect(reviewIcon).toBe(expectedIcon);
    });
  });

  it('review helpers should fallback to NEW when property labels are missing', () => {
    // Arrange
    const property = ListingPropertiesTableMockFactory.createProperty({ propertyId: 'missing' });
    component.propertyLabels = [];

    // Action
    const reviewClass = component.getReviewClass(property);
    const reviewIcon = component.getReviewIcon(property);

    // Assert
    expect(reviewClass).toBe('new');
    expect(reviewIcon).toBe('flare');
  });

  [
    { language: 'en' as const, key: 'TITLE' as const, expected: 'Title' },
    { language: 'sp' as const, key: 'TITLE' as const, expected: 'Título' }
  ].forEach(({ language, key, expected }) => {
    it(`t should return ${expected} in ${language}`, () => {
      // Arrange
      component.selectedLanguage = language;

      // Action
      const translated = component.t(key);

      // Assert
      expect(translated).toBe(expected);
    });
  });
});
