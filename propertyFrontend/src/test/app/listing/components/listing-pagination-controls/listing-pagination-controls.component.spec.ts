import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DASHBOARD_PAGE_SIZE_OPTIONS } from 'src/app/listing/model/pagination/listing-pagination.model';
import { ListingPaginationControlsComponent } from 'src/app/listing/components/listing-pagination-controls/listing-pagination-controls.component';

class ListingPaginationControlsMockFactory {
  static configureState(
    component: ListingPaginationControlsComponent,
    state: Partial<
      Pick<
        ListingPaginationControlsComponent,
        'page' | 'totalPages' | 'pageSize' | 'loading' | 'selectedLanguage'
      >
    >
  ): void {
    component.page = state.page ?? component.page;
    component.totalPages = state.totalPages ?? component.totalPages;
    component.pageSize = state.pageSize ?? component.pageSize;
    component.loading = state.loading ?? component.loading;
    component.selectedLanguage = state.selectedLanguage ?? component.selectedLanguage;
  }

  static createSelectEvent(value: string): Event {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
    select.value = value;
    return { target: select } as unknown as Event;
  }

  static createNonSelectEvent(): Event {
    const div = document.createElement('div');
    return { target: div } as unknown as Event;
  }
}

describe('ListingPaginationControlsComponent', () => {
  let fixture: ComponentFixture<ListingPaginationControlsComponent>;
  let component: ListingPaginationControlsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingPaginationControlsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ListingPaginationControlsComponent);
    component = fixture.componentInstance;
  });

  [
    { page: 5, totalPages: 0, expected: 0 },
    { page: 1, totalPages: -2, expected: 0 },
    { page: 0, totalPages: 10, expected: 1 },
    { page: 11, totalPages: 10, expected: 10 },
    { page: 4, totalPages: 10, expected: 4 }
  ].forEach(({ page, totalPages, expected }) => {
    it(`whenPageIs${page}AndTotalPagesIs${totalPages}_normalizedCurrentPage_shouldBe${expected}`, () => {
      // Arrange
      ListingPaginationControlsMockFactory.configureState(component, { page, totalPages });

      // Action
      const result = component.normalizedCurrentPage();

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { page: 2, totalPages: 0, expected: [] as number[] },
    { page: 5, totalPages: 10, expected: [2, 3, 4, 5, 6, 7, 8] },
    { page: 10, totalPages: 10, expected: [4, 5, 6, 7, 8, 9, 10] },
    { page: 1, totalPages: 3, expected: [1, 2, 3] }
  ].forEach(({ page, totalPages, expected }) => {
    it(`whenPageIs${page}AndTotalPagesIs${totalPages}_visiblePages_shouldMatchWindow`, () => {
      // Arrange
      ListingPaginationControlsMockFactory.configureState(component, { page, totalPages });

      // Action
      const result = component.visiblePages();

      // Assert
      expect(result).toEqual(expected);
    });
  });

  it('whenSelectablePageSizesIsCalled_shouldReturnCopyOfOptions', () => {
    // Arrange
    const firstRead = component.selectablePageSizes();

    // Action
    firstRead.push(9999);
    const secondRead = component.selectablePageSizes();

    // Assert
    expect(secondRead).toEqual(DASHBOARD_PAGE_SIZE_OPTIONS);
    expect(secondRead).not.toContain(9999);
  });

  [
    { loading: true, page: 2, totalPages: 10, expected: false },
    { loading: false, page: 1, totalPages: 10, expected: false },
    { loading: false, page: 2, totalPages: 10, expected: true }
  ].forEach(({ loading, page, totalPages, expected }) => {
    it(`whenLoadingIs${loading}AndPageIs${page}_canGoPrevious_shouldBe${expected}`, () => {
      // Arrange
      ListingPaginationControlsMockFactory.configureState(component, { loading, page, totalPages });

      // Action
      const result = component.canGoPrevious();

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { loading: true, page: 1, totalPages: 2, expected: false },
    { loading: false, page: 1, totalPages: 0, expected: false },
    { loading: false, page: 2, totalPages: 2, expected: false },
    { loading: false, page: 1, totalPages: 2, expected: true }
  ].forEach(({ loading, page, totalPages, expected }) => {
    it(`whenLoadingIs${loading}AndPageIs${page}AndTotalPagesIs${totalPages}_canGoNext_shouldBe${expected}`, () => {
      // Arrange
      ListingPaginationControlsMockFactory.configureState(component, { loading, page, totalPages });

      // Action
      const result = component.canGoNext();

      // Assert
      expect(result).toBe(expected);
    });
  });

  it('whenPreviousClickIsAllowed_shouldEmitPreviousPage', () => {
    // Arrange
    ListingPaginationControlsMockFactory.configureState(component, {
      loading: false,
      page: 3,
      totalPages: 5
    });
    const emitSpy = spyOn(component.pageChange, 'emit');

    // Action
    component.onPreviousClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(2);
  });

  it('whenPreviousClickIsBlocked_shouldNotEmitPageChange', () => {
    // Arrange
    ListingPaginationControlsMockFactory.configureState(component, {
      loading: false,
      page: 1,
      totalPages: 5
    });
    const emitSpy = spyOn(component.pageChange, 'emit');

    // Action
    component.onPreviousClick();

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('whenNextClickIsAllowed_shouldEmitNextPage', () => {
    // Arrange
    ListingPaginationControlsMockFactory.configureState(component, {
      loading: false,
      page: 2,
      totalPages: 5
    });
    const emitSpy = spyOn(component.pageChange, 'emit');

    // Action
    component.onNextClick();

    // Assert
    expect(emitSpy).toHaveBeenCalledOnceWith(3);
  });

  it('whenNextClickIsBlocked_shouldNotEmitPageChange', () => {
    // Arrange
    ListingPaginationControlsMockFactory.configureState(component, {
      loading: true,
      page: 2,
      totalPages: 5
    });
    const emitSpy = spyOn(component.pageChange, 'emit');

    // Action
    component.onNextClick();

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
  });

  [
    { loading: true, clickedPage: 3, currentPage: 2, expectedCalls: 0 },
    { loading: false, clickedPage: 2, currentPage: 2, expectedCalls: 0 },
    { loading: false, clickedPage: 3, currentPage: 2, expectedCalls: 1 }
  ].forEach(({ loading, clickedPage, currentPage, expectedCalls }) => {
    it(`whenPageNumberClickHasLoading${loading}AndClickedPage${clickedPage}_shouldEmit${expectedCalls}Times`, () => {
      // Arrange
      ListingPaginationControlsMockFactory.configureState(component, {
        loading,
        page: currentPage,
        totalPages: 10
      });
      const emitSpy = spyOn(component.pageChange, 'emit');

      // Action
      component.onPageNumberClick(clickedPage);

      // Assert
      expect(emitSpy.calls.count()).toBe(expectedCalls);
      if (expectedCalls === 1) {
        expect(emitSpy).toHaveBeenCalledWith(clickedPage);
      }
    });
  });

  it('whenPageSizeSelectEventComesFromNonSelectTarget_shouldNotEmit', () => {
    // Arrange
    const emitSpy = spyOn(component.pageSizeChange, 'emit');

    // Action
    component.onPageSizeSelect(ListingPaginationControlsMockFactory.createNonSelectEvent());

    // Assert
    expect(emitSpy).not.toHaveBeenCalled();
  });

  [
    { value: '500', shouldEmit: true, emittedValue: 500 },
    { value: '0', shouldEmit: false, emittedValue: 0 },
    { value: 'abc', shouldEmit: false, emittedValue: 0 }
  ].forEach(({ value, shouldEmit, emittedValue }) => {
    it(`whenPageSizeSelectValueIs${value}_shouldEmitIs${shouldEmit}`, () => {
      // Arrange
      const emitSpy = spyOn(component.pageSizeChange, 'emit');
      const event = ListingPaginationControlsMockFactory.createSelectEvent(value);

      // Action
      component.onPageSizeSelect(event);

      // Assert
      if (shouldEmit) {
        expect(emitSpy).toHaveBeenCalledOnceWith(emittedValue);
      } else {
        expect(emitSpy).not.toHaveBeenCalled();
      }
    });
  });

  [
    { language: 'en' as const, key: 'listing.PAGINATION_PAGE' as const, expected: 'Page' },
    { language: 'sp' as const, key: 'listing.PAGINATION_PAGE' as const, expected: 'Página' }
  ].forEach(({ language, key, expected }) => {
    it(`whenLanguageIs${language}_tShouldReturnLocalizedText`, () => {
      // Arrange
      component.selectedLanguage = language;

      // Action
      const translation = component.t(key);

      // Assert
      expect(translation).toBe(expected);
    });
  });
});
