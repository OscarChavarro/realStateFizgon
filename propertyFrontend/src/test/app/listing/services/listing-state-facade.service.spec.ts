import { TestBed } from '@angular/core/testing';
import { createDefaultListingFilters } from 'src/app/listing/model/filters/listing-filters.model';
import { ListingStateFacadeService } from 'src/app/listing/services/listing-state-facade.service';
import { ListingDataService } from 'src/app/listing/services/listing-data.service';
import { SortCriteriaService } from 'src/app/listing/services/sort-criteria.service';
import { MaintenanceOperationRunnerService } from 'src/app/maintenance/services/maintenance-operation-runner.service';
import { UserPreferencesService } from 'src/app/prefs/services/user-preferences.service';

describe('ListingStateFacadeService', () => {
  let service: ListingStateFacadeService;
  let listingDataServiceMock: { loadBackendConfiguration: jasmine.Spy; loadListingData: jasmine.Spy };
  let userPreferencesServiceMock: { saveFilters: jasmine.Spy; loadPreferences: jasmine.Spy };
  let sortCriteriaServiceMock: { cycleSortCriteria: jasmine.Spy };
  let maintenanceOperationRunnerServiceMock: { runOperation: jasmine.Spy };

  beforeEach(() => {
    listingDataServiceMock = {
      loadBackendConfiguration: jasmine.createSpy('loadBackendConfiguration').and.resolveTo({ backendBaseUrl: 'b' }),
      loadListingData: jasmine.createSpy('loadListingData').and.resolveTo({ count: 0, properties: [], pagination: { page: 1, pageSize: 100, totalElements: 0, totalPages: 0 } })
    };
    userPreferencesServiceMock = {
      saveFilters: jasmine.createSpy('saveFilters').and.resolveTo(undefined),
      loadPreferences: jasmine.createSpy('loadPreferences').and.resolveTo(null)
    };
    sortCriteriaServiceMock = {
      cycleSortCriteria: jasmine.createSpy('cycleSortCriteria').and.returnValue([])
    };
    maintenanceOperationRunnerServiceMock = {
      runOperation: jasmine.createSpy('runOperation').and.resolveTo('ok')
    };

    TestBed.configureTestingModule({
      providers: [
        ListingStateFacadeService,
        { provide: ListingDataService, useValue: listingDataServiceMock },
        { provide: UserPreferencesService, useValue: userPreferencesServiceMock },
        { provide: SortCriteriaService, useValue: sortCriteriaServiceMock },
        { provide: MaintenanceOperationRunnerService, useValue: maintenanceOperationRunnerServiceMock }
      ]
    });

    service = TestBed.inject(ListingStateFacadeService);
    sessionStorage.clear();
  });

  [
    { stored: 'en', expected: 'en' },
    { stored: 'sp', expected: 'sp' },
    { stored: 'fr', expected: 'en' },
    { stored: null, expected: 'en' }
  ].forEach(({ stored, expected }) => {
    it(`loadSelectedLanguageFromSession should return ${expected} for stored=${String(stored)}`, () => {
      // Arrange
      if (stored === null) {
        sessionStorage.removeItem('lang');
      } else {
        sessionStorage.setItem('lang', stored);
      }

      // Action
      const result = service.loadSelectedLanguageFromSession('lang');

      // Assert
      expect(result).toBe(expected);
      if (stored !== 'en' && stored !== 'sp') {
        expect(sessionStorage.getItem('lang')).toBe('en');
      }
    });
  });

  it('persistSelectedLanguage should write selected language in session', () => {
    // Arrange

    // Action
    service.persistSelectedLanguage('lang', 'sp');

    // Assert
    expect(sessionStorage.getItem('lang')).toBe('sp');
  });

  it('loadBackendConfiguration should delegate to listing data service', async () => {
    // Arrange
    const http = {} as any;

    // Action
    await service.loadBackendConfiguration(http);

    // Assert
    expect(listingDataServiceMock.loadBackendConfiguration).toHaveBeenCalledOnceWith(http);
  });

  it('refreshListingData should delegate to listing data service', async () => {
    // Arrange
    const http = {} as any;
    const filters = createDefaultListingFilters();
    const sortCriteria: any[] = [{ sortBy: 'title', sortOrder: 'asc' }];

    // Action
    await service.refreshListingData(http, sortCriteria as any, filters, 2, 500);

    // Assert
    expect(listingDataServiceMock.loadListingData).toHaveBeenCalledOnceWith(http, sortCriteria, filters, 2, 500);
  });

  it('areFiltersChanged should return false when filters are equal', () => {
    // Arrange
    const current = createDefaultListingFilters();
    const next = { ...current };

    // Action
    const changed = service.areFiltersChanged(current, next);

    // Assert
    expect(changed).toBeFalse();
  });

  [
    { key: 'showClosed', value: false },
    { key: 'showNew', value: false },
    { key: 'showFavourite', value: false },
    { key: 'showRejected', value: false },
    { key: 'minPublicationDate', value: '2026-01-01' },
    { key: 'maxPublicationDate', value: '2026-02-01' },
    { key: 'minPrice', value: '1000' },
    { key: 'maxPrice', value: '2000' }
  ].forEach(({ key, value }) => {
    it(`areFiltersChanged should return true when ${key} differs`, () => {
      // Arrange
      const current = createDefaultListingFilters();
      const next = { ...current, [key]: value } as any;

      // Action
      const changed = service.areFiltersChanged(current, next);

      // Assert
      expect(changed).toBeTrue();
    });
  });

  it('saveFiltersPreference should delegate to preferences service', async () => {
    // Arrange
    const http = {} as any;
    const filters = createDefaultListingFilters();
    const sortCriteria: any[] = [];

    // Action
    await service.saveFiltersPreference(http, filters, 'en', sortCriteria as any, 100);

    // Assert
    expect(userPreferencesServiceMock.saveFilters).toHaveBeenCalledOnceWith(http, filters, 'en', sortCriteria, 100);
  });

  it('loadUserPreferences should delegate to preferences service', async () => {
    // Arrange
    const http = {} as any;

    // Action
    await service.loadUserPreferences(http);

    // Assert
    expect(userPreferencesServiceMock.loadPreferences).toHaveBeenCalledOnceWith(http);
  });

  it('toggleSortCriteria should delegate to sort criteria service', () => {
    // Arrange
    const currentSortCriteria: any[] = [{ sortBy: 'title', sortOrder: 'asc' }];

    // Action
    service.toggleSortCriteria(currentSortCriteria as any, 'price');

    // Assert
    expect(sortCriteriaServiceMock.cycleSortCriteria).toHaveBeenCalledOnceWith(currentSortCriteria, 'price');
  });

  it('runMaintenanceOperation should delegate to maintenance operation runner', async () => {
    // Arrange
    const operation = {} as any;
    const http = {} as any;

    // Action
    await service.runMaintenanceOperation(operation, http);

    // Assert
    expect(maintenanceOperationRunnerServiceMock.runOperation).toHaveBeenCalledOnceWith(operation, http);
  });
});
