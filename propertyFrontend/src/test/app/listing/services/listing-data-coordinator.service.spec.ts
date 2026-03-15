import { TestBed } from '@angular/core/testing';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';

describe('ListingDataCoordinatorService', () => {
  let service: ListingDataCoordinatorService;
  let listingStateFacadeServiceMock: {
    refreshListingData: jasmine.Spy;
    areFiltersChanged: jasmine.Spy;
    saveFiltersPreference: jasmine.Spy;
    loadUserPreferences: jasmine.Spy;
    toggleSortCriteria: jasmine.Spy;
    runMaintenanceOperation: jasmine.Spy;
  };

  beforeEach(() => {
    listingStateFacadeServiceMock = {
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo({
        count: 15,
        properties: [{ propertyId: 'p1' }],
        pagination: { page: 2, pageSize: 100, totalElements: 33, totalPages: 1 }
      }),
      areFiltersChanged: jasmine.createSpy('areFiltersChanged').and.returnValue(true),
      saveFiltersPreference: jasmine.createSpy('saveFiltersPreference').and.resolveTo(undefined),
      loadUserPreferences: jasmine.createSpy('loadUserPreferences').and.resolveTo(null),
      toggleSortCriteria: jasmine.createSpy('toggleSortCriteria').and.returnValue([{ sortBy: 'price', sortOrder: 'asc' }]),
      runMaintenanceOperation: jasmine.createSpy('runMaintenanceOperation').and.resolveTo('operation-result')
    };

    TestBed.configureTestingModule({
      providers: [
        ListingDataCoordinatorService,
        { provide: ListingStateFacadeService, useValue: listingStateFacadeServiceMock }
      ]
    });

    service = TestBed.inject(ListingDataCoordinatorService);
  });

  it('refreshListingData should update state and call callbacks', async () => {
    // Arrange
    const setLoading = jasmine.createSpy('setLoading');
    const setCount = jasmine.createSpy('setCount');
    const setAllProperties = jasmine.createSpy('setAllProperties');
    const setPagination = jasmine.createSpy('setPagination');
    const onAfterRefresh = jasmine.createSpy('onAfterRefresh');
    const filters = createDefaultListingFilters();
    const sortCriteria: any[] = [{ sortBy: 'title', sortOrder: 'asc' }];
    const pagination = { page: 1, pageSize: 100, totalElements: 0, totalPages: 0 };

    // Action
    await service.refreshListingData({
      http: {} as any,
      sortCriteria: sortCriteria as any,
      filters,
      pagination,
      setLoading,
      setCount,
      setAllProperties,
      setPagination,
      onAfterRefresh
    });

    // Assert
    expect(setLoading.calls.allArgs()).toEqual([[true], [false]]);
    expect(setCount).toHaveBeenCalledWith(15);
    expect(setAllProperties).toHaveBeenCalledWith([{ propertyId: 'p1' }]);
    expect(setPagination).toHaveBeenCalledWith({ page: 2, pageSize: 100, totalElements: 33, totalPages: 1 });
    expect(onAfterRefresh).toHaveBeenCalled();
  });

  it('handleFiltersChange should return early when filters are unchanged', async () => {
    // Arrange
    listingStateFacadeServiceMock.areFiltersChanged.and.returnValue(false);
    const setFilters = jasmine.createSpy('setFilters');
    const onFiltersChanged = jasmine.createSpy('onFiltersChanged');
    const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);
    const filters = createDefaultListingFilters();

    // Action
    await service.handleFiltersChange({
      http: {} as any,
      currentFilters: filters,
      nextFilters: filters,
      sortCriteria: [],
      pageSize: 100,
      selectedLanguage: 'en',
      isAuthenticated: true,
      setFilters,
      onFiltersChanged,
      onRefreshListingData
    });

    // Assert
    expect(setFilters).toHaveBeenCalled();
    expect(onFiltersChanged).not.toHaveBeenCalled();
    expect(onRefreshListingData).not.toHaveBeenCalled();
  });

  it('handleFiltersChange should persist preferences and refresh when filters changed and authenticated', async () => {
    // Arrange
    const setFilters = jasmine.createSpy('setFilters');
    const onFiltersChanged = jasmine.createSpy('onFiltersChanged');
    const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);
    const currentFilters = createDefaultListingFilters();
    const nextFilters = { ...currentFilters, showClosed: false };

    // Action
    await service.handleFiltersChange({
      http: {} as any,
      currentFilters,
      nextFilters,
      sortCriteria: [],
      pageSize: 100,
      selectedLanguage: 'en',
      isAuthenticated: true,
      setFilters,
      onFiltersChanged,
      onRefreshListingData
    });

    // Assert
    expect(listingStateFacadeServiceMock.saveFiltersPreference).toHaveBeenCalled();
    expect(onRefreshListingData).toHaveBeenCalled();
  });

  it('handleFiltersChange should ignore save errors and still refresh', async () => {
    // Arrange
    listingStateFacadeServiceMock.saveFiltersPreference.and.rejectWith(new Error('save-error'));
    const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);
    const filters = createDefaultListingFilters();

    // Action
    await service.handleFiltersChange({
      http: {} as any,
      currentFilters: filters,
      nextFilters: { ...filters, minPrice: '1200' },
      sortCriteria: [],
      pageSize: 100,
      selectedLanguage: 'en',
      isAuthenticated: true,
      setFilters: jasmine.createSpy('setFilters'),
      onFiltersChanged: jasmine.createSpy('onFiltersChanged'),
      onRefreshListingData
    });

    // Assert
    expect(onRefreshListingData).toHaveBeenCalled();
  });

  it('handleFiltersChange should refresh without saving when unauthenticated', async () => {
    // Arrange
    const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);
    const filters = createDefaultListingFilters();

    // Action
    await service.handleFiltersChange({
      http: {} as any,
      currentFilters: filters,
      nextFilters: { ...filters, maxPrice: '1500' },
      sortCriteria: [],
      pageSize: 100,
      selectedLanguage: 'en',
      isAuthenticated: false,
      setFilters: jasmine.createSpy('setFilters'),
      onFiltersChanged: jasmine.createSpy('onFiltersChanged'),
      onRefreshListingData
    });

    // Assert
    expect(listingStateFacadeServiceMock.saveFiltersPreference).not.toHaveBeenCalled();
    expect(onRefreshListingData).toHaveBeenCalled();
  });

  it('loadUserPreferences should reset defaults when no preferences exist', async () => {
    // Arrange
    const setFilters = jasmine.createSpy('setFilters');
    const setSortCriteria = jasmine.createSpy('setSortCriteria');
    const setPageSize = jasmine.createSpy('setPageSize');
    const setSelectedLanguage = jasmine.createSpy('setSelectedLanguage');
    const persistSelectedLanguage = jasmine.createSpy('persistSelectedLanguage');
    const setPropertyLabels = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.loadUserPreferences({
      http: {} as any,
      setFilters,
      setSortCriteria,
      setPageSize,
      setSelectedLanguage,
      persistSelectedLanguage,
      setPropertyLabels
    });

    // Assert
    expect(setFilters).toHaveBeenCalledWith(createDefaultListingFilters());
    expect(setSortCriteria).toHaveBeenCalledWith([]);
    expect(setPropertyLabels).toHaveBeenCalledWith([]);
    expect(setSelectedLanguage).not.toHaveBeenCalled();
    expect(persistSelectedLanguage).not.toHaveBeenCalled();
    expect(setPageSize).not.toHaveBeenCalled();
  });

  it('loadUserPreferences should apply loaded preferences', async () => {
    // Arrange
    listingStateFacadeServiceMock.loadUserPreferences.and.resolveTo({
      language: 'sp',
      pageSize: 500,
      filters: { ...createDefaultListingFilters(), showClosed: false },
      sortCriteria: [{ sortBy: 'price', sortOrder: 'asc' }],
      propertyLabels: [{ propertyId: 'p-1', labels: { review: 'NEW' } }]
    });
    const setFilters = jasmine.createSpy('setFilters');
    const setSortCriteria = jasmine.createSpy('setSortCriteria');
    const setPageSize = jasmine.createSpy('setPageSize');
    const setSelectedLanguage = jasmine.createSpy('setSelectedLanguage');
    const persistSelectedLanguage = jasmine.createSpy('persistSelectedLanguage');
    const setPropertyLabels = jasmine.createSpy('setPropertyLabels');

    // Action
    await service.loadUserPreferences({
      http: {} as any,
      setFilters,
      setSortCriteria,
      setPageSize,
      setSelectedLanguage,
      persistSelectedLanguage,
      setPropertyLabels
    });

    // Assert
    expect(setSelectedLanguage).toHaveBeenCalledWith('sp');
    expect(persistSelectedLanguage).toHaveBeenCalledWith('sp');
    expect(setPageSize).toHaveBeenCalledWith(500);
    expect(setFilters).toHaveBeenCalled();
    expect(setSortCriteria).toHaveBeenCalled();
    expect(setPropertyLabels).toHaveBeenCalled();
  });

  it('saveLanguagePreference should return when unauthenticated', async () => {
    // Arrange

    // Action
    await service.saveLanguagePreference({} as any, false, createDefaultListingFilters(), [], 100, 'en');

    // Assert
    expect(listingStateFacadeServiceMock.saveFiltersPreference).not.toHaveBeenCalled();
  });

  it('saveLanguagePreference should save preference when authenticated', async () => {
    // Arrange

    // Action
    await service.saveLanguagePreference({} as any, true, createDefaultListingFilters(), [], 100, 'en');

    // Assert
    expect(listingStateFacadeServiceMock.saveFiltersPreference).toHaveBeenCalled();
  });

  it('saveLanguagePreference should swallow save errors', async () => {
    // Arrange
    listingStateFacadeServiceMock.saveFiltersPreference.and.rejectWith(new Error('save-error'));

    // Action
    await service.saveLanguagePreference({} as any, true, createDefaultListingFilters(), [], 100, 'en');

    // Assert
    expect().nothing();
  });

  it('toggleSortAndRefresh should save and refresh for authenticated user', async () => {
    // Arrange
    const setSortCriteria = jasmine.createSpy('setSortCriteria');
    const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

    // Action
    await service.toggleSortAndRefresh({
      http: {} as any,
      currentSortCriteria: [],
      sortBy: 'price',
      filters: createDefaultListingFilters(),
      pageSize: 100,
      selectedLanguage: 'en',
      isAuthenticated: true,
      setSortCriteria,
      onRefreshListingData
    });

    // Assert
    expect(setSortCriteria).toHaveBeenCalledWith([{ sortBy: 'price', sortOrder: 'asc' }]);
    expect(listingStateFacadeServiceMock.saveFiltersPreference).toHaveBeenCalled();
    expect(onRefreshListingData).toHaveBeenCalled();
  });

  it('toggleSortAndRefresh should refresh when unauthenticated without saving', async () => {
    // Arrange
    const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

    // Action
    await service.toggleSortAndRefresh({
      http: {} as any,
      currentSortCriteria: [],
      sortBy: 'price',
      filters: createDefaultListingFilters(),
      pageSize: 100,
      selectedLanguage: 'en',
      isAuthenticated: false,
      setSortCriteria: jasmine.createSpy('setSortCriteria'),
      onRefreshListingData
    });

    // Assert
    expect(listingStateFacadeServiceMock.saveFiltersPreference).not.toHaveBeenCalled();
    expect(onRefreshListingData).toHaveBeenCalled();
  });

  it('toggleSortAndRefresh should swallow save errors and still refresh', async () => {
    // Arrange
    listingStateFacadeServiceMock.saveFiltersPreference.and.rejectWith(new Error('save-error'));
    const onRefreshListingData = jasmine.createSpy('onRefreshListingData').and.resolveTo(undefined);

    // Action
    await service.toggleSortAndRefresh({
      http: {} as any,
      currentSortCriteria: [],
      sortBy: 'price',
      filters: createDefaultListingFilters(),
      pageSize: 100,
      selectedLanguage: 'en',
      isAuthenticated: true,
      setSortCriteria: jasmine.createSpy('setSortCriteria'),
      onRefreshListingData
    });

    // Assert
    expect(onRefreshListingData).toHaveBeenCalled();
  });

  it('runMaintenanceOperation should set running flags and operation result', async () => {
    // Arrange
    const setMaintenanceRunning = jasmine.createSpy('setMaintenanceRunning');
    const setMaintenanceResultText = jasmine.createSpy('setMaintenanceResultText');

    // Action
    await service.runMaintenanceOperation({
      operation: {} as any,
      http: {} as any,
      setMaintenanceRunning,
      setMaintenanceResultText
    });

    // Assert
    expect(setMaintenanceRunning.calls.allArgs()).toEqual([[true], [false]]);
    expect(setMaintenanceResultText.calls.allArgs()).toEqual([[''], ['operation-result']]);
  });
});
