import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { createDefaultListingPaginationState } from 'src/app/listing/model/pagination/listing-pagination.model';
import { PropertyLabelEntry, SortCriterion } from 'src/app/listing/model/listing.types';
import { ListingDataCoordinatorService } from 'src/app/listing/services/listing-data-coordinator.service';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { AppShellStateService } from 'src/app/shell/services/app-shell-state.service';

class ListingDataCoordinatorServiceMockFactory {
  static createListingStateFacadeMock() {
    return {
      refreshListingData: jasmine.createSpy('refreshListingData').and.resolveTo({
        count: 15,
        properties: [{ propertyId: 'p1' }],
        pagination: { page: 2, pageSize: 100, totalElements: 33, totalPages: 1 }
      }),
      areFiltersChanged: jasmine.createSpy('areFiltersChanged').and.returnValue(true),
      saveFiltersPreference: jasmine.createSpy('saveFiltersPreference').and.resolveTo(undefined),
      loadUserPreferences: jasmine.createSpy('loadUserPreferences').and.resolveTo(null),
      persistSelectedLanguage: jasmine.createSpy('persistSelectedLanguage'),
      toggleSortCriteria: jasmine.createSpy('toggleSortCriteria').and.returnValue([{ sortBy: 'price', sortOrder: 'asc' }]),
      runMaintenanceOperation: jasmine.createSpy('runMaintenanceOperation').and.resolveTo('operation-result')
    };
  }

  static createAppShellStateMock() {
    return {
      loading: signal(false),
      count: signal(0),
      allProperties: signal<Array<{ propertyId: string }>>([]),
      pagination: signal(createDefaultListingPaginationState()),
      filters: signal(createDefaultListingFilters()),
      selectedLanguage: signal<'en' | 'sp'>('en'),
      sortCriteria: signal<SortCriterion[]>([]),
      propertyLabels: signal<PropertyLabelEntry[]>([]),
      authenticatedUser: signal<any>(null),
      maintenanceRunning: signal(false),
      maintenanceResultText: signal('')
    };
  }
}

describe('ListingDataCoordinatorService', () => {
  let service: ListingDataCoordinatorService;
  let listingStateFacadeServiceMock: ReturnType<typeof ListingDataCoordinatorServiceMockFactory.createListingStateFacadeMock>;
  let appShellStateMock: ReturnType<typeof ListingDataCoordinatorServiceMockFactory.createAppShellStateMock>;

  beforeEach(() => {
    listingStateFacadeServiceMock = ListingDataCoordinatorServiceMockFactory.createListingStateFacadeMock();
    appShellStateMock = ListingDataCoordinatorServiceMockFactory.createAppShellStateMock();

    TestBed.configureTestingModule({
      providers: [
        ListingDataCoordinatorService,
        { provide: ListingStateFacadeService, useValue: listingStateFacadeServiceMock },
        { provide: AppShellStateService, useValue: appShellStateMock }
      ]
    });

    service = TestBed.inject(ListingDataCoordinatorService);
  });

  it('whenRefreshListingData_refreshListingData_shouldUpdateStoreAndInvokeAfterRefresh', async () => {
    // Arrange
    const onAfterRefresh = jasmine.createSpy('onAfterRefresh');
    const pagination = { page: 1, pageSize: 100, totalElements: 0, totalPages: 0 };

    // Action
    await service.refreshListingData({} as any, pagination, onAfterRefresh);

    // Assert
    expect(appShellStateMock.loading()).toBeFalse();
    expect(appShellStateMock.count()).toBe(15);
    expect(appShellStateMock.allProperties()).toEqual([{ propertyId: 'p1' }]);
    expect(appShellStateMock.pagination()).toEqual({ page: 2, pageSize: 100, totalElements: 33, totalPages: 1 });
    expect(onAfterRefresh).toHaveBeenCalledTimes(1);
  });

  it('whenFiltersAreUnchanged_handleFiltersChange_shouldReturnFalseAndSkipSave', async () => {
    // Arrange
    listingStateFacadeServiceMock.areFiltersChanged.and.returnValue(false);
    const filters = createDefaultListingFilters();
    appShellStateMock.filters.set(filters);

    // Action
    const changed = await service.handleFiltersChange({} as any, filters);

    // Assert
    expect(changed).toBeFalse();
    expect(listingStateFacadeServiceMock.saveFiltersPreference).not.toHaveBeenCalled();
  });

  it('whenFiltersChangeAndUserIsAuthenticated_handleFiltersChange_shouldResetPageAndPersist', async () => {
    // Arrange
    const currentFilters = createDefaultListingFilters();
    const nextFilters = { ...currentFilters, showClosed: false };
    appShellStateMock.filters.set(currentFilters);
    appShellStateMock.pagination.update((state) => ({ ...state, page: 7, pageSize: 500 }));
    appShellStateMock.sortCriteria.set([{ sortBy: 'title', sortOrder: 'asc' }]);
    appShellStateMock.authenticatedUser.set({ id: 'user-1' });

    // Action
    const changed = await service.handleFiltersChange({} as any, nextFilters);

    // Assert
    expect(changed).toBeTrue();
    expect(appShellStateMock.filters()).toEqual(nextFilters);
    expect(appShellStateMock.pagination().page).toBe(1);
    expect(listingStateFacadeServiceMock.saveFiltersPreference).toHaveBeenCalledOnceWith(
      {} as any,
      nextFilters,
      'en',
      [{ sortBy: 'title', sortOrder: 'asc' }],
      500
    );
  });

  it('whenFiltersChangeAndPreferenceSaveFails_handleFiltersChange_shouldStillReturnTrue', async () => {
    // Arrange
    listingStateFacadeServiceMock.saveFiltersPreference.and.rejectWith(new Error('save-error'));
    const currentFilters = createDefaultListingFilters();
    appShellStateMock.filters.set(currentFilters);
    appShellStateMock.authenticatedUser.set({ id: 'user-1' });

    // Action
    const changed = await service.handleFiltersChange({} as any, { ...currentFilters, minPrice: '1200' });

    // Assert
    expect(changed).toBeTrue();
  });

  it('whenNoStoredPreferences_loadUserPreferences_shouldApplyDefaults', async () => {
    // Arrange
    appShellStateMock.filters.set({ ...createDefaultListingFilters(), showClosed: false });
    appShellStateMock.sortCriteria.set([{ sortBy: 'price', sortOrder: 'asc' }]);
    appShellStateMock.propertyLabels.set([{ propertyId: 'p1', labels: { review: 'NEW' } }]);

    // Action
    await service.loadUserPreferences({} as any, 'selected-language');

    // Assert
    expect(appShellStateMock.filters()).toEqual(createDefaultListingFilters());
    expect(appShellStateMock.sortCriteria()).toEqual([]);
    expect(appShellStateMock.propertyLabels()).toEqual([]);
  });

  it('whenStoredPreferencesExist_loadUserPreferences_shouldApplyPreferencesToStore', async () => {
    // Arrange
    listingStateFacadeServiceMock.loadUserPreferences.and.resolveTo({
      language: 'sp',
      pageSize: 500,
      filters: { ...createDefaultListingFilters(), showClosed: false },
      sortCriteria: [{ sortBy: 'price', sortOrder: 'asc' }],
      propertyLabels: [{ propertyId: 'p-1', labels: { review: 'NEW' } }]
    });

    // Action
    await service.loadUserPreferences({} as any, 'selected-language');

    // Assert
    expect(appShellStateMock.selectedLanguage()).toBe('sp');
    expect(appShellStateMock.pagination().pageSize).toBe(500);
    expect(appShellStateMock.filters().showClosed).toBeFalse();
    expect(appShellStateMock.sortCriteria()).toEqual([{ sortBy: 'price', sortOrder: 'asc' }]);
    expect(appShellStateMock.propertyLabels()).toEqual([{ propertyId: 'p-1', labels: { review: 'NEW' } }]);
    expect(listingStateFacadeServiceMock.persistSelectedLanguage).toHaveBeenCalledOnceWith('selected-language', 'sp');
  });

  it('whenLanguageChangesWhileUnauthenticated_saveLanguagePreference_shouldSkipPersistence', async () => {
    // Arrange
    appShellStateMock.authenticatedUser.set(null);

    // Action
    await service.saveLanguagePreference({} as any, 'sp');

    // Assert
    expect(listingStateFacadeServiceMock.saveFiltersPreference).not.toHaveBeenCalled();
  });

  it('whenLanguageChangesWhileAuthenticated_saveLanguagePreference_shouldPersistPreferences', async () => {
    // Arrange
    appShellStateMock.authenticatedUser.set({ id: 'user-1' });
    appShellStateMock.filters.set({ ...createDefaultListingFilters(), showClosed: false });
    appShellStateMock.sortCriteria.set([{ sortBy: 'price', sortOrder: 'desc' }]);
    appShellStateMock.pagination.update((state) => ({ ...state, pageSize: 500 }));

    // Action
    await service.saveLanguagePreference({} as any, 'sp');

    // Assert
    expect(listingStateFacadeServiceMock.saveFiltersPreference).toHaveBeenCalledOnceWith(
      {} as any,
      { ...createDefaultListingFilters(), showClosed: false },
      'sp',
      [{ sortBy: 'price', sortOrder: 'desc' }],
      500
    );
  });

  it('whenSortChanges_toggleSortAndRefresh_shouldUpdateSortAndPersistForAuthenticatedUser', async () => {
    // Arrange
    appShellStateMock.authenticatedUser.set({ id: 'user-1' });
    appShellStateMock.sortCriteria.set([]);

    // Action
    await service.toggleSortAndRefresh({} as any, 'price');

    // Assert
    expect(listingStateFacadeServiceMock.toggleSortCriteria).toHaveBeenCalledOnceWith([], 'price');
    expect(appShellStateMock.sortCriteria()).toEqual([{ sortBy: 'price', sortOrder: 'asc' }]);
    expect(listingStateFacadeServiceMock.saveFiltersPreference).toHaveBeenCalled();
  });

  it('whenMaintenanceRuns_runMaintenanceOperation_shouldSetRunningAndResult', async () => {
    // Arrange
    appShellStateMock.maintenanceRunning.set(false);
    appShellStateMock.maintenanceResultText.set('old');

    // Action
    await service.runMaintenanceOperation({} as any, {} as any);

    // Assert
    expect(appShellStateMock.maintenanceRunning()).toBeFalse();
    expect(appShellStateMock.maintenanceResultText()).toBe('operation-result');
  });
});
