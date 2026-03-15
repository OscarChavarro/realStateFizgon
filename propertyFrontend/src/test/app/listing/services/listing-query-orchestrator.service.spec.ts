import { TestBed } from '@angular/core/testing';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { ListingQueryOrchestratorService } from 'src/app/listing/services/listing-query-orchestrator.service';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';

describe('ListingQueryOrchestratorService', () => {
  let service: ListingQueryOrchestratorService;
  let listingDataCoordinatorServiceMock: {
    refreshListingData: jasmine.Spy;
    handleFiltersChange: jasmine.Spy;
    toggleSortAndRefresh: jasmine.Spy;
    saveLanguagePreference: jasmine.Spy;
    loadUserPreferences: jasmine.Spy;
  };

  beforeEach(() => {
    listingDataCoordinatorServiceMock = {
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo(undefined),
      handleFiltersChange: jasmine.createSpy('handleFiltersChange').and.resolveTo(undefined),
      toggleSortAndRefresh: jasmine.createSpy('toggleSortAndRefresh').and.resolveTo(undefined),
      saveLanguagePreference: jasmine.createSpy('saveLanguagePreference').and.resolveTo(undefined),
      loadUserPreferences: jasmine.createSpy('loadUserPreferences').and.resolveTo(undefined)
    };

    TestBed.configureTestingModule({
      providers: [
        ListingQueryOrchestratorService,
        { provide: ListingDataCoordinatorService, useValue: listingDataCoordinatorServiceMock }
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
      const setFilteredTotalElements = jasmine.createSpy('setFilteredTotalElements');

      // Action
      service.persistFilteredTotalElementsInSession(input, setFilteredTotalElements);

      // Assert
      expect(setFilteredTotalElements).toHaveBeenCalledOnceWith(expected);
      expect(sessionStorage.getItem('filteredTotalElements')).toBe(String(expected));
    });
  });

  it('refreshListingData should delegate and persist filtered total elements from pagination callback', async () => {
    // Arrange
    const setPagination = jasmine.createSpy('setPagination');
    const setFilteredTotalElements = jasmine.createSpy('setFilteredTotalElements');
    const params = {
      http: {} as any,
      getSortCriteria: () => [],
      getFilters: () => createDefaultListingFilters(),
      getPagination: () => ({ page: 2, pageSize: 100, totalElements: 0, totalPages: 0 }),
      setLoading: jasmine.createSpy('setLoading'),
      setCount: jasmine.createSpy('setCount'),
      setAllProperties: jasmine.createSpy('setAllProperties'),
      setPagination,
      onAfterRefresh: jasmine.createSpy('onAfterRefresh'),
      setFilteredTotalElements
    };

    // Action
    await service.refreshListingData(params);
    const delegatedParams = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args[0];
    delegatedParams.setPagination({ page: 1, pageSize: 100, totalElements: 23, totalPages: 1 });

    // Assert
    expect(listingDataCoordinatorServiceMock.refreshListingData).toHaveBeenCalled();
    expect(setPagination).toHaveBeenCalledWith({ page: 1, pageSize: 100, totalElements: 23, totalPages: 1 });
    expect(setFilteredTotalElements).toHaveBeenCalledWith(23);
  });

  it('refreshListingData should fallback request page size when current page size is invalid', async () => {
    // Arrange
    const params = {
      http: {} as any,
      getSortCriteria: () => [],
      getFilters: () => createDefaultListingFilters(),
      getPagination: () => ({ page: 3, pageSize: 0, totalElements: 0, totalPages: 0 }),
      setLoading: jasmine.createSpy('setLoading'),
      setCount: jasmine.createSpy('setCount'),
      setAllProperties: jasmine.createSpy('setAllProperties'),
      setPagination: jasmine.createSpy('setPagination'),
      onAfterRefresh: jasmine.createSpy('onAfterRefresh'),
      setFilteredTotalElements: jasmine.createSpy('setFilteredTotalElements')
    };

    // Action
    await service.refreshListingData(params);
    const delegatedParams = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args[0];

    // Assert
    expect(delegatedParams.pagination.pageSize).toBe(100);
  });

  it('refreshListingData should use page 1 when resolved request page size is 0', async () => {
    // Arrange
    spyOn<any>(service, 'resolveRequestPageSize').and.returnValue(0);
    const params = {
      http: {} as any,
      getSortCriteria: () => [],
      getFilters: () => createDefaultListingFilters(),
      getPagination: () => ({ page: 8, pageSize: 100, totalElements: 0, totalPages: 0 }),
      setLoading: jasmine.createSpy('setLoading'),
      setCount: jasmine.createSpy('setCount'),
      setAllProperties: jasmine.createSpy('setAllProperties'),
      setPagination: jasmine.createSpy('setPagination'),
      onAfterRefresh: jasmine.createSpy('onAfterRefresh'),
      setFilteredTotalElements: jasmine.createSpy('setFilteredTotalElements')
    };

    // Action
    await service.refreshListingData(params);
    const delegatedParams = listingDataCoordinatorServiceMock.refreshListingData.calls.mostRecent().args[0];

    // Assert
    expect(delegatedParams.pagination.page).toBe(1);
    expect(delegatedParams.pagination.pageSize).toBe(0);
  });

  it('handleFiltersChange should delegate to listing data coordinator', async () => {
    // Arrange
    const nextFilters = { ...createDefaultListingFilters(), showClosed: false };

    // Action
    await service.handleFiltersChange({
      http: {} as any,
      getCurrentFilters: () => createDefaultListingFilters(),
      nextFilters,
      getSortCriteria: () => [],
      getPageSize: () => 100,
      getSelectedLanguage: () => 'en',
      isAuthenticated: () => true,
      setFilters: jasmine.createSpy('setFilters'),
      onResetToFirstPage: jasmine.createSpy('onResetToFirstPage'),
      onRefreshListingData: jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined)
    });

    // Assert
    expect(listingDataCoordinatorServiceMock.handleFiltersChange).toHaveBeenCalled();
  });

  it('toggleSort should reset page and delegate to listing data coordinator', async () => {
    // Arrange
    const onResetToFirstPage = jasmine.createSpy('onResetToFirstPage');

    // Action
    await service.toggleSort({
      http: {} as any,
      sortBy: 'price',
      getSortCriteria: () => [],
      getFilters: () => createDefaultListingFilters(),
      getPageSize: () => 100,
      getSelectedLanguage: () => 'en',
      isAuthenticated: () => true,
      setSortCriteria: jasmine.createSpy('setSortCriteria'),
      onResetToFirstPage,
      onRefreshListingData: jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined)
    });

    // Assert
    expect(onResetToFirstPage).toHaveBeenCalled();
    expect(listingDataCoordinatorServiceMock.toggleSortAndRefresh).toHaveBeenCalled();
  });

  [
    {
      title: 'ignore unchanged page',
      page: 2,
      current: { page: 2, pageSize: 100, totalElements: 30, totalPages: 5 },
      expectedSetPageCall: false,
      expectedPage: 2
    },
    {
      title: 'normalize to min page',
      page: 0,
      current: { page: 3, pageSize: 100, totalElements: 30, totalPages: 5 },
      expectedSetPageCall: true,
      expectedPage: 1
    },
    {
      title: 'normalize to max page',
      page: 9,
      current: { page: 1, pageSize: 100, totalElements: 30, totalPages: 4 },
      expectedSetPageCall: true,
      expectedPage: 4
    },
    {
      title: 'use current page for non-finite input',
      page: Number.NaN,
      current: { page: 2, pageSize: 100, totalElements: 30, totalPages: 4 },
      expectedSetPageCall: false,
      expectedPage: 2
    }
  ].forEach(({ title, page, current, expectedSetPageCall, expectedPage }) => {
    it(`changePage should ${title}`, async () => {
      // Arrange
      const setPage = jasmine.createSpy('setPage');
      const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

      // Action
      await service.changePage({
        page,
        getPagination: () => current,
        setPage,
        onRefreshListingData
      });

      // Assert
      expect(setPage.calls.any()).toBe(expectedSetPageCall);
      if (expectedSetPageCall) {
        expect(setPage).toHaveBeenCalledWith(expectedPage);
        expect(onRefreshListingData).toHaveBeenCalled();
      } else {
        expect(onRefreshListingData).not.toHaveBeenCalled();
      }
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
      const setPagination = jasmine.createSpy('setPagination');
      const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

      // Action
      await service.changePageSize({
        http: {} as any,
        pageSize,
        getPagination: () => ({ page: 3, pageSize: currentPageSize, totalElements: 0, totalPages: 0 }),
        setPagination,
        getFilters: () => createDefaultListingFilters(),
        getSortCriteria: () => [],
        getSelectedLanguage: () => 'en',
        isAuthenticated: () => true,
        onRefreshListingData
      });

      // Assert
      if (shouldReturn) {
        expect(setPagination).not.toHaveBeenCalled();
        expect(listingDataCoordinatorServiceMock.saveLanguagePreference).not.toHaveBeenCalled();
        expect(onRefreshListingData).not.toHaveBeenCalled();
      } else {
        expect(setPagination).toHaveBeenCalledWith({ page: 1, pageSize: 500, totalElements: 0, totalPages: 0 });
        expect(listingDataCoordinatorServiceMock.saveLanguagePreference).toHaveBeenCalled();
        expect(onRefreshListingData).toHaveBeenCalled();
      }
    });
  });

  it('loadUserPreferences should reset filtered total elements and delegate', async () => {
    // Arrange
    const setFilteredTotalElements = jasmine.createSpy('setFilteredTotalElements');

    // Action
    await service.loadUserPreferences({
      http: {} as any,
      setSelectedLanguage: jasmine.createSpy('setSelectedLanguage'),
      persistSelectedLanguage: jasmine.createSpy('persistSelectedLanguage'),
      setFilters: jasmine.createSpy('setFilters'),
      setSortCriteria: jasmine.createSpy('setSortCriteria'),
      setPageSize: jasmine.createSpy('setPageSize'),
      setPropertyLabels: jasmine.createSpy('setPropertyLabels'),
      setFilteredTotalElements
    });

    // Assert
    expect(setFilteredTotalElements).toHaveBeenCalledWith(0);
    expect(sessionStorage.getItem('filteredTotalElements')).toBe('0');
    expect(listingDataCoordinatorServiceMock.loadUserPreferences).toHaveBeenCalled();
  });
});
