import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { createDefaultListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { ListingPropertyRow, PropertyLabelEntry, SortCriterion } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { PropertySelectionService } from 'src/app/listing/services/property-selection.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

class ListingQueryOrchestratorMockFactory {
  static createAppShellStateMock() {
    const allProperties = signal<ListingPropertyRow[]>([]);
    return {
      loading: signal(false),
      count: signal(0),
      allProperties,
      properties: computed(() => allProperties()),
      filters: signal(createDefaultListingFilters()),
      pagination: signal(createDefaultListingPaginationState()),
      selectedLanguage: signal<'en' | 'sp'>('en'),
      authenticatedUser: signal(null),
      filteredTotalElements: signal(0),
      propertyLabels: signal<PropertyLabelEntry[]>([]),
      sortCriteria: signal<SortCriterion[]>([])
    };
  }

  static createProperty(overrides: Partial<ListingPropertyRow> = {}): ListingPropertyRow {
    return {
      propertyId: 'property-1',
      publicationDate: '2026-03-15T12:00:00.000Z',
      publicationDateShort: '2026-03-15',
      title: 'Sample Property',
      url: 'https://example.com/property-1',
      price: '1400',
      location: 'Madrid',
      advertiserComment: 'Comment',
      localImageUrls: [],
      unavailable: false,
      geoLocationHint: { lat: 40.4, lon: -3.7 },
      ...overrides
    };
  }
}

describe('ListingQueryOrchestratorService', () => {
  let service: ListingQueryOrchestratorService;
  let listingDataCoordinatorServiceMock: {
    refreshListingData: jasmine.Spy;
    handleFiltersChange: jasmine.Spy;
    toggleSortAndRefresh: jasmine.Spy;
    saveLanguagePreference: jasmine.Spy;
    loadUserPreferences: jasmine.Spy;
  };
  let propertySelectionServiceMock: {
    syncAfterRefresh: jasmine.Spy;
  };
  let appShellStateMock: ReturnType<typeof ListingQueryOrchestratorMockFactory.createAppShellStateMock>;

  beforeEach(() => {
    listingDataCoordinatorServiceMock = {
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo(undefined),
      handleFiltersChange: jasmine.createSpy('handleFiltersChange').and.resolveTo(false),
      toggleSortAndRefresh: jasmine.createSpy('toggleSortAndRefresh').and.resolveTo(undefined),
      saveLanguagePreference: jasmine.createSpy('saveLanguagePreference').and.resolveTo(undefined),
      loadUserPreferences: jasmine.createSpy('loadUserPreferences').and.resolveTo(undefined)
    };
    propertySelectionServiceMock = {
      syncAfterRefresh: jasmine.createSpy('syncAfterRefresh')
    };
    appShellStateMock = ListingQueryOrchestratorMockFactory.createAppShellStateMock();

    TestBed.configureTestingModule({
      providers: [
        ListingQueryOrchestratorService,
        { provide: ListingDataCoordinatorService, useValue: listingDataCoordinatorServiceMock },
        { provide: PropertySelectionService, useValue: propertySelectionServiceMock },
        { provide: AppShellStateService, useValue: appShellStateMock }
      ]
    });

    service = TestBed.inject(ListingQueryOrchestratorService);
    sessionStorage.clear();
  });

  [
    { stored: '12', expected: 12 },
    { stored: '-1', expected: 0 },
    { stored: 'abc', expected: 0 },
    { stored: null, expected: 0 }
  ].forEach(({ stored, expected }) => {
    it(`whenReadingStoredTotal_readFilteredTotalElementsFromSession_shouldReturn${expected}`, () => {
      // Arrange
      if (stored === null) {
        sessionStorage.removeItem('filteredTotalElements');
      } else {
        sessionStorage.setItem('filteredTotalElements', stored);
      }

      // Action
      const result = service.readFilteredTotalElementsFromSession();

      // Assert
      expect(result).toBe(expected);
    });
  });

  [
    { input: 15.7, expected: 15 },
    { input: -1, expected: 0 },
    { input: Number.NaN, expected: 0 }
  ].forEach(({ input, expected }) => {
    it(`whenPersistingFilteredTotal_persistFilteredTotalElementsInSession_shouldNormalizeTo${expected}`, () => {
      // Arrange
      appShellStateMock.filteredTotalElements.set(99);

      // Action
      service.persistFilteredTotalElementsInSession(input);

      // Assert
      expect(appShellStateMock.filteredTotalElements()).toBe(expected);
      expect(sessionStorage.getItem('filteredTotalElements')).toBe(String(expected));
    });
  });

  it('whenRefreshingListing_refreshListingData_shouldDelegateAndPersistFilteredTotal', async () => {
    // Arrange
    const property = ListingQueryOrchestratorMockFactory.createProperty();
    appShellStateMock.pagination.set({ page: 2, pageSize: 100, totalElements: 0, totalPages: 0 });
    listingDataCoordinatorServiceMock.refreshListingData.and.callFake(
      async (_http: unknown, _pagination: unknown, onAfterRefresh?: () => void) => {
        appShellStateMock.allProperties.set([property]);
        appShellStateMock.pagination.set({ page: 2, pageSize: 100, totalElements: 23, totalPages: 1 });
        onAfterRefresh?.();
      }
    );

    // Action
    await service.refreshListingData({} as any);

    // Assert
    expect(listingDataCoordinatorServiceMock.refreshListingData).toHaveBeenCalled();
    expect(propertySelectionServiceMock.syncAfterRefresh).toHaveBeenCalledWith([property]);
    expect(appShellStateMock.filteredTotalElements()).toBe(23);
    expect(sessionStorage.getItem('filteredTotalElements')).toBe('23');
  });

  it('whenPageSizeIsInvalid_refreshListingData_shouldFallbackToDefaultRequestPageSize', async () => {
    // Arrange
    appShellStateMock.pagination.set({ page: 3, pageSize: 0, totalElements: 0, totalPages: 0 });

    // Action
    await service.refreshListingData({} as any);

    // Assert
    const args = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args;
    expect(args[1]).toEqual({ page: 3, pageSize: 100, totalElements: 0, totalPages: 0 });
  });

  it('whenResolvedPageSizeIsZero_refreshListingData_shouldForceRequestPageOne', async () => {
    // Arrange
    spyOn<any>(service, 'resolveRequestPageSize').and.returnValue(0);
    appShellStateMock.pagination.set({ page: 8, pageSize: 100, totalElements: 0, totalPages: 0 });

    // Action
    await service.refreshListingData({} as any);

    // Assert
    const args = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args;
    expect(args[1]).toEqual({ page: 1, pageSize: 0, totalElements: 0, totalPages: 0 });
  });

  it('whenFiltersDoNotChange_handleFiltersChange_shouldSkipRefresh', async () => {
    // Arrange
    listingDataCoordinatorServiceMock.handleFiltersChange.and.resolveTo(false);
    const refreshSpy = spyOn(service, 'refreshListingData').and.resolveTo(undefined);

    // Action
    await service.handleFiltersChange({} as any, { ...createDefaultListingFilters(), showClosed: false });

    // Assert
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('whenFiltersChange_handleFiltersChange_shouldRefresh', async () => {
    // Arrange
    listingDataCoordinatorServiceMock.handleFiltersChange.and.resolveTo(true);
    const refreshSpy = spyOn(service, 'refreshListingData').and.resolveTo(undefined);

    // Action
    await service.handleFiltersChange({} as any, { ...createDefaultListingFilters(), showClosed: false });

    // Assert
    expect(listingDataCoordinatorServiceMock.handleFiltersChange).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('whenSortChanges_toggleSort_shouldResetPageAndRefresh', async () => {
    // Arrange
    appShellStateMock.pagination.set({ page: 7, pageSize: 100, totalElements: 0, totalPages: 0 });
    const refreshSpy = spyOn(service, 'refreshListingData').and.resolveTo(undefined);

    // Action
    await service.toggleSort({} as any, 'price');

    // Assert
    expect(appShellStateMock.pagination().page).toBe(1);
    expect(listingDataCoordinatorServiceMock.toggleSortAndRefresh).toHaveBeenCalledOnceWith({} as any, 'price');
    expect(refreshSpy).toHaveBeenCalled();
  });

  [
    {
      title: 'ignore unchanged page',
      page: 2,
      current: { page: 2, pageSize: 100, totalElements: 30, totalPages: 5 },
      expectedPage: 2,
      expectedRefreshCalls: 0
    },
    {
      title: 'normalize to min page',
      page: 0,
      current: { page: 3, pageSize: 100, totalElements: 30, totalPages: 5 },
      expectedPage: 1,
      expectedRefreshCalls: 1
    },
    {
      title: 'normalize to max page',
      page: 9,
      current: { page: 1, pageSize: 100, totalElements: 30, totalPages: 4 },
      expectedPage: 4,
      expectedRefreshCalls: 1
    },
    {
      title: 'use current page for non-finite input',
      page: Number.NaN,
      current: { page: 2, pageSize: 100, totalElements: 30, totalPages: 4 },
      expectedPage: 2,
      expectedRefreshCalls: 0
    }
  ].forEach(({ title, page, current, expectedPage, expectedRefreshCalls }) => {
    it(`whenChangingPage_changePage_should${title.replace(/\s/g, '')}`, async () => {
      // Arrange
      appShellStateMock.pagination.set(current);
      const refreshSpy = spyOn(service, 'refreshListingData').and.resolveTo(undefined);

      // Action
      await service.changePage({} as any, page);

      // Assert
      expect(appShellStateMock.pagination().page).toBe(expectedPage);
      expect(refreshSpy).toHaveBeenCalledTimes(expectedRefreshCalls);
    });
  });

  [
    { pageSize: 0, currentPageSize: 100, shouldReturn: true },
    { pageSize: Number.NaN, currentPageSize: 100, shouldReturn: true },
    { pageSize: 100, currentPageSize: 100, shouldReturn: true },
    { pageSize: 500.8, currentPageSize: 100, shouldReturn: false }
  ].forEach(({ pageSize, currentPageSize, shouldReturn }) => {
    it(`whenChangingPageSize_changePageSize_shouldHandleValue${String(pageSize)}`, async () => {
      // Arrange
      appShellStateMock.pagination.set({ page: 3, pageSize: currentPageSize, totalElements: 0, totalPages: 0 });
      const refreshSpy = spyOn(service, 'refreshListingData').and.resolveTo(undefined);

      // Action
      await service.changePageSize({} as any, pageSize);

      // Assert
      if (shouldReturn) {
        expect(listingDataCoordinatorServiceMock.saveLanguagePreference).not.toHaveBeenCalled();
        expect(refreshSpy).not.toHaveBeenCalled();
      } else {
        expect(appShellStateMock.pagination()).toEqual({ page: 1, pageSize: 500, totalElements: 0, totalPages: 0 });
        expect(listingDataCoordinatorServiceMock.saveLanguagePreference).toHaveBeenCalledOnceWith({} as any, 'en');
        expect(refreshSpy).toHaveBeenCalled();
      }
    });
  });

  it('whenLoadingUserPreferences_loadUserPreferences_shouldResetFilteredTotalAndDelegate', async () => {
    // Arrange
    appShellStateMock.filteredTotalElements.set(32);

    // Action
    await service.loadUserPreferences({} as any);

    // Assert
    expect(appShellStateMock.filteredTotalElements()).toBe(0);
    expect(sessionStorage.getItem('filteredTotalElements')).toBe('0');
    expect(listingDataCoordinatorServiceMock.loadUserPreferences).toHaveBeenCalledOnceWith({} as any, 'selectedLanguage');
  });

  it('whenResettingGuestState_resetGuestListingState_shouldRestoreDefaultsAndPersistTotal', () => {
    // Arrange
    appShellStateMock.filters.set({ ...createDefaultListingFilters(), showClosed: false, minPrice: '1000' });
    appShellStateMock.pagination.set({ page: 9, pageSize: 500, totalElements: 30, totalPages: 3 });
    appShellStateMock.filteredTotalElements.set(30);
    appShellStateMock.sortCriteria.set([{ sortBy: 'price', sortOrder: 'desc' }]);
    appShellStateMock.propertyLabels.set([{ propertyId: 'property-1', labels: { review: 'DISCHARGED' } }]);

    // Action
    service.resetGuestListingState();

    // Assert
    expect(appShellStateMock.filters()).toEqual(createDefaultListingFilters());
    expect(appShellStateMock.pagination()).toEqual(createDefaultListingPaginationState());
    expect(appShellStateMock.filteredTotalElements()).toBe(0);
    expect(appShellStateMock.sortCriteria()).toEqual([]);
    expect(appShellStateMock.propertyLabels()).toEqual([]);
    expect(sessionStorage.getItem('filteredTotalElements')).toBe('0');
  });
});
