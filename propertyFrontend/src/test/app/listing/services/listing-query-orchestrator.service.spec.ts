import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { createDefaultListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { ListingPropertyRow, PropertyLabelEntry, SortCriterion } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
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
  let listingStateFacadeServiceMock: {
    persistSelectedLanguage: jasmine.Spy;
  };
  let propertySelectionServiceMock: {
    syncAfterRefresh: jasmine.Spy;
  };
  let appShellStateMock: ReturnType<typeof ListingQueryOrchestratorMockFactory.createAppShellStateMock>;

  beforeEach(() => {
    listingDataCoordinatorServiceMock = {
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo(undefined),
      handleFiltersChange: jasmine.createSpy('handleFiltersChange').and.resolveTo(undefined),
      toggleSortAndRefresh: jasmine.createSpy('toggleSortAndRefresh').and.resolveTo(undefined),
      saveLanguagePreference: jasmine.createSpy('saveLanguagePreference').and.resolveTo(undefined),
      loadUserPreferences: jasmine.createSpy('loadUserPreferences').and.resolveTo(undefined)
    };
    listingStateFacadeServiceMock = {
      persistSelectedLanguage: jasmine.createSpy('persistSelectedLanguage')
    };
    propertySelectionServiceMock = {
      syncAfterRefresh: jasmine.createSpy('syncAfterRefresh')
    };
    appShellStateMock = ListingQueryOrchestratorMockFactory.createAppShellStateMock();

    TestBed.configureTestingModule({
      providers: [
        ListingQueryOrchestratorService,
        { provide: ListingDataCoordinatorService, useValue: listingDataCoordinatorServiceMock },
        { provide: ListingStateFacadeService, useValue: listingStateFacadeServiceMock },
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
    it(`readFilteredTotalElementsFromSession should return ${expected} for "${String(stored)}"`, () => {
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
    it(`persistFilteredTotalElementsInSession should normalize ${input} to ${expected}`, () => {
      // Arrange
      appShellStateMock.filteredTotalElements.set(99);

      // Action
      service.persistFilteredTotalElementsInSession(input);

      // Assert
      expect(appShellStateMock.filteredTotalElements()).toBe(expected);
      expect(sessionStorage.getItem('filteredTotalElements')).toBe(String(expected));
    });
  });

  it('refreshListingData should delegate and persist filtered total elements from pagination callback', async () => {
    // Arrange
    const property = ListingQueryOrchestratorMockFactory.createProperty();
    appShellStateMock.pagination.set({ page: 2, pageSize: 100, totalElements: 0, totalPages: 0 });

    // Action
    await service.refreshListingData({} as any);
    const delegatedParams = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args[0];
    delegatedParams.setLoading(true);
    delegatedParams.setCount(3);
    delegatedParams.setAllProperties([property]);
    delegatedParams.setPagination({ page: 1, pageSize: 100, totalElements: 23, totalPages: 1 });
    delegatedParams.onAfterRefresh();
    delegatedParams.setLoading(false);

    // Assert
    expect(listingDataCoordinatorServiceMock.refreshListingData).toHaveBeenCalled();
    expect(appShellStateMock.loading()).toBeFalse();
    expect(appShellStateMock.count()).toBe(3);
    expect(appShellStateMock.allProperties()).toEqual([property]);
    expect(appShellStateMock.pagination()).toEqual({ page: 1, pageSize: 100, totalElements: 23, totalPages: 1 });
    expect(appShellStateMock.filteredTotalElements()).toBe(23);
    expect(propertySelectionServiceMock.syncAfterRefresh).toHaveBeenCalledWith([property]);
  });

  it('refreshListingData should fallback request page size when current page size is invalid', async () => {
    // Arrange
    appShellStateMock.pagination.set({ page: 3, pageSize: 0, totalElements: 0, totalPages: 0 });

    // Action
    await service.refreshListingData({} as any);
    const delegatedParams = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args[0];

    // Assert
    expect(delegatedParams.pagination.pageSize).toBe(100);
  });

  it('refreshListingData should use page 1 when resolved request page size is 0', async () => {
    // Arrange
    spyOn<any>(service, 'resolveRequestPageSize').and.returnValue(0);
    appShellStateMock.pagination.set({ page: 8, pageSize: 100, totalElements: 0, totalPages: 0 });

    // Action
    await service.refreshListingData({} as any);
    const delegatedParams = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args[0];

    // Assert
    expect(delegatedParams.pagination.page).toBe(1);
    expect(delegatedParams.pagination.pageSize).toBe(0);
  });

  it('handleFiltersChange should delegate to listing data coordinator with state-backed callbacks', async () => {
    // Arrange
    const nextFilters = { ...createDefaultListingFilters(), showClosed: false };
    appShellStateMock.pagination.set({ page: 4, pageSize: 100, totalElements: 0, totalPages: 0 });
    const refreshSpy = spyOn(service, 'refreshListingData').and.resolveTo(undefined);

    // Action
    await service.handleFiltersChange({} as any, nextFilters);
    const delegatedParams = listingDataCoordinatorServiceMock.handleFiltersChange.calls.mostRecent().args[0];
    delegatedParams.setFilters(nextFilters);
    delegatedParams.onFiltersChanged();
    await delegatedParams.onRefreshListingData();

    // Assert
    expect(listingDataCoordinatorServiceMock.handleFiltersChange).toHaveBeenCalled();
    expect(appShellStateMock.filters()).toEqual(nextFilters);
    expect(appShellStateMock.pagination().page).toBe(1);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('toggleSort should reset page and delegate to listing data coordinator', async () => {
    // Arrange
    appShellStateMock.pagination.set({ page: 7, pageSize: 100, totalElements: 0, totalPages: 0 });
    const refreshSpy = spyOn(service, 'refreshListingData').and.resolveTo(undefined);

    // Action
    await service.toggleSort({} as any, 'price');
    const delegatedParams = listingDataCoordinatorServiceMock.toggleSortAndRefresh.calls.mostRecent().args[0];
    delegatedParams.setSortCriteria([{ sortBy: 'price', sortOrder: 'desc' }]);
    await delegatedParams.onRefreshListingData();

    // Assert
    expect(appShellStateMock.pagination().page).toBe(1);
    expect(appShellStateMock.sortCriteria()).toEqual([{ sortBy: 'price', sortOrder: 'desc' }]);
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
    it(`changePage should ${title}`, async () => {
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
    it(`changePageSize should handle pageSize=${pageSize} and current=${currentPageSize}`, async () => {
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
        expect(listingDataCoordinatorServiceMock.saveLanguagePreference).toHaveBeenCalled();
        expect(refreshSpy).toHaveBeenCalled();
      }
    });
  });

  it('loadUserPreferences should reset filtered total elements and bridge state callbacks', async () => {
    // Arrange
    const labels: PropertyLabelEntry[] = [{ propertyId: 'property-1', labels: { review: 'FAVOURITE' } }];
    listingDataCoordinatorServiceMock.loadUserPreferences.and.callFake(async (params: any) => {
      params.setSelectedLanguage('sp');
      params.persistSelectedLanguage('sp');
      params.setFilters({ ...createDefaultListingFilters(), showFavourite: false });
      params.setSortCriteria([{ sortBy: 'title', sortOrder: 'asc' }]);
      params.setPageSize(500);
      params.setPropertyLabels(labels);
    });

    // Action
    await service.loadUserPreferences({} as any);

    // Assert
    expect(appShellStateMock.filteredTotalElements()).toBe(0);
    expect(sessionStorage.getItem('filteredTotalElements')).toBe('0');
    expect(appShellStateMock.selectedLanguage()).toBe('sp');
    expect(appShellStateMock.filters().showFavourite).toBeFalse();
    expect(appShellStateMock.sortCriteria()).toEqual([{ sortBy: 'title', sortOrder: 'asc' }]);
    expect(appShellStateMock.pagination().pageSize).toBe(500);
    expect(appShellStateMock.propertyLabels()).toEqual(labels);
    expect(listingStateFacadeServiceMock.persistSelectedLanguage).toHaveBeenCalledWith('selectedLanguage', 'sp');
  });

  it('resetGuestListingState should reset listing state defaults and persist total elements to session', () => {
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
