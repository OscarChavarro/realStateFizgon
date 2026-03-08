import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { OriginErrorDetectorService } from 'src/application/services/resilience/origin-error-detector.service';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

class ChromeConfigMockForPreparation {
  readonly chromeCdpReadyTimeoutMs = 1000;
  readonly chromeCdpPollIntervalMs = 50;
  readonly chromeExpressionTimeoutMs = 1000;
  readonly chromeExpressionPollIntervalMs = 50;
  readonly chromeOriginErrorReloadWaitMs = 10;
}

class ScraperConfigMockForPreparation {
  readonly scraperHomeUrl = 'https://www.idealista.com/';
  readonly mainPageFirstLoadDeviceVerificationWaitMs = 10;
  readonly mainSearchArea = 'Madrid';
}

class ChromiumPageSyncServiceMockForPreparation {
  readonly waitForPageLoad = jest.fn<(page: unknown, runtime: unknown, timeout: number, poll: number) => Promise<void>>();
  readonly waitForExpression = jest.fn<(runtime: unknown, expression: string, timeout: number, poll: number) => Promise<void>>();
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class MainPageServiceMockForPreparation {
  readonly execute = jest.fn<(client: unknown, mainSearchArea: string, homeUrl: string) => Promise<void>>();
}

class FiltersServiceMockForPreparation {
  readonly execute = jest.fn<(client: unknown) => Promise<void>>();
}

class PropertyListPageServiceMockForPreparation {
  readonly resetProcessedUrlsForCurrentSearch = jest.fn<() => void>();
}

class OriginErrorDetectorServiceMockForPreparation {
  readonly hasOriginError = jest.fn<(runtime: unknown) => Promise<boolean>>();
}

type PageDomainMock = {
  navigate(params: { url: string }): Promise<void>;
  reload(params?: { ignoreCache?: boolean }): Promise<void>;
  loadEventFired(cb: () => void): void;
};

type RuntimeDomainMock = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

function createRuntimeEvaluate(url: string): RuntimeDomainMock['evaluate'] {
  const evaluateMock = jest.fn(async (params: { expression: string }) => {
    if (params.expression === 'window.location.href') {
      return { result: { value: url } };
    }
    return { result: { value: true } };
  });
  return evaluateMock as unknown as RuntimeDomainMock['evaluate'];
}

function createPageAndRuntime(url: string): { page: PageDomainMock; runtime: RuntimeDomainMock } {
  const navigate = jest.fn(async () => undefined) as unknown as PageDomainMock['navigate'];
  const reload = jest.fn(async () => undefined) as unknown as PageDomainMock['reload'];
  const loadEventFired = jest.fn() as unknown as PageDomainMock['loadEventFired'];
  return {
    page: {
      navigate,
      reload,
      loadEventFired
    },
    runtime: {
      evaluate: createRuntimeEvaluate(url)
    }
  };
}

function createPageAndRuntimeWithoutLocationResult(): { page: PageDomainMock; runtime: RuntimeDomainMock } {
  const navigate = jest.fn(async () => undefined) as unknown as PageDomainMock['navigate'];
  const reload = jest.fn(async () => undefined) as unknown as PageDomainMock['reload'];
  const loadEventFired = jest.fn() as unknown as PageDomainMock['loadEventFired'];
  const evaluate = jest.fn(async (params: { expression: string }) => {
    if (params.expression === 'window.location.href') {
      return {};
    }
    return { result: { value: true } };
  }) as unknown as RuntimeDomainMock['evaluate'];

  return {
    page: {
      navigate,
      reload,
      loadEventFired
    },
    runtime: {
      evaluate
    }
  };
}

describe('SearchResultsPreparationService', () => {
  it('whenCurrentPageIsNotHome_prepareSearchResultsWithFilters_shouldNavigateHomeAndContinueFlow', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPreparation();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPreparation();
    mainPage.execute.mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPreparation();
    filters.execute.mockResolvedValue(undefined);
    const propertyList = new PropertyListPageServiceMockForPreparation();
    const originError = new OriginErrorDetectorServiceMockForPreparation();
    originError.hasOriginError.mockResolvedValue(false);
    const service = new SearchResultsPreparationService(
      new ChromeConfigMockForPreparation() as unknown as ChromeConfig,
      new ScraperConfigMockForPreparation() as unknown as ScraperConfig,
      sync as unknown as ChromiumPageSyncService,
      mainPage as unknown as MainPageService,
      filters as unknown as FiltersService,
      propertyList as unknown as PropertyListPageService,
      originError as unknown as OriginErrorDetectorService
    );
    const cdp = createPageAndRuntime('https://other-page.local/');
    // Action
    await service.prepareSearchResultsWithFilters({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    // Assert
    expect(cdp.page.navigate as unknown as jest.Mock).toHaveBeenCalledWith({ url: 'https://www.idealista.com/' });
    expect(sync.waitForPageLoad).toHaveBeenCalled();
    expect(filters.execute).toHaveBeenCalled();
  });

  it('whenPreparationRunsTwice_prepareSearchResultsWithFilters_shouldApplyFirstHomePageWaitOnlyOnce', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPreparation();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPreparation();
    mainPage.execute.mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPreparation();
    filters.execute.mockResolvedValue(undefined);
    const propertyList = new PropertyListPageServiceMockForPreparation();
    const originError = new OriginErrorDetectorServiceMockForPreparation();
    originError.hasOriginError.mockResolvedValue(false);
    const service = new SearchResultsPreparationService(
      new ChromeConfigMockForPreparation() as unknown as ChromeConfig,
      new ScraperConfigMockForPreparation() as unknown as ScraperConfig,
      sync as unknown as ChromiumPageSyncService,
      mainPage as unknown as MainPageService,
      filters as unknown as FiltersService,
      propertyList as unknown as PropertyListPageService,
      originError as unknown as OriginErrorDetectorService
    );
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    await service.prepareSearchResultsWithFilters({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    await service.prepareSearchResultsWithFilters({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    // Assert
    expect(sync.sleep).toHaveBeenCalledTimes(1);
    expect(propertyList.resetProcessedUrlsForCurrentSearch).toHaveBeenCalledTimes(4);
  });

  it('whenLocationEvaluateReturnsNoValue_prepareSearchResultsWithFilters_shouldFallbackToEmptyCurrentUrlAndNavigateHome', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPreparation();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPreparation();
    mainPage.execute.mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPreparation();
    filters.execute.mockResolvedValue(undefined);
    const propertyList = new PropertyListPageServiceMockForPreparation();
    const originError = new OriginErrorDetectorServiceMockForPreparation();
    originError.hasOriginError.mockResolvedValue(false);
    const service = new SearchResultsPreparationService(
      new ChromeConfigMockForPreparation() as unknown as ChromeConfig,
      new ScraperConfigMockForPreparation() as unknown as ScraperConfig,
      sync as unknown as ChromiumPageSyncService,
      mainPage as unknown as MainPageService,
      filters as unknown as FiltersService,
      propertyList as unknown as PropertyListPageService,
      originError as unknown as OriginErrorDetectorService
    );
    const cdp = createPageAndRuntimeWithoutLocationResult();
    // Action
    await service.prepareSearchResultsWithFilters({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    // Assert
    expect(cdp.page.navigate as unknown as jest.Mock).toHaveBeenCalledWith({ url: 'https://www.idealista.com/' });
    expect(filters.execute).toHaveBeenCalled();
  });

  it('whenMainPageFailsAndOriginErrorIsVisible_executeMainPageWithRetry_shouldReloadAndRetry', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPreparation();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPreparation();
    mainPage.execute
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPreparation();
    const propertyList = new PropertyListPageServiceMockForPreparation();
    const originError = new OriginErrorDetectorServiceMockForPreparation();
    originError.hasOriginError
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const service = new SearchResultsPreparationService(
      new ChromeConfigMockForPreparation() as unknown as ChromeConfig,
      new ScraperConfigMockForPreparation() as unknown as ScraperConfig,
      sync as unknown as ChromiumPageSyncService,
      mainPage as unknown as MainPageService,
      filters as unknown as FiltersService,
      propertyList as unknown as PropertyListPageService,
      originError as unknown as OriginErrorDetectorService
    );
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    await (service as unknown as {
      executeMainPageWithRetry: (client: unknown, page: unknown, runtime: unknown) => Promise<void>;
    }).executeMainPageWithRetry({ Page: cdp.page, Runtime: cdp.runtime }, cdp.page, cdp.runtime);
    // Assert
    expect(cdp.page.reload as unknown as jest.Mock).toHaveBeenCalledWith({ ignoreCache: true });
    expect(mainPage.execute).toHaveBeenCalledTimes(2);
    expect(sync.sleep).toHaveBeenCalled();
  });

  it('whenMainPageFailsOnLastRetry_executeMainPageWithRetry_shouldThrowOriginalError', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPreparation();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPreparation();
    mainPage.execute.mockRejectedValue(new Error('final-failure'));
    const filters = new FiltersServiceMockForPreparation();
    const propertyList = new PropertyListPageServiceMockForPreparation();
    const originError = new OriginErrorDetectorServiceMockForPreparation();
    originError.hasOriginError.mockResolvedValue(false);
    const service = new SearchResultsPreparationService(
      new ChromeConfigMockForPreparation() as unknown as ChromeConfig,
      new ScraperConfigMockForPreparation() as unknown as ScraperConfig,
      sync as unknown as ChromiumPageSyncService,
      mainPage as unknown as MainPageService,
      filters as unknown as FiltersService,
      propertyList as unknown as PropertyListPageService,
      originError as unknown as OriginErrorDetectorService
    );
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    const action = (service as unknown as {
      executeMainPageWithRetry: (client: unknown, page: unknown, runtime: unknown) => Promise<void>;
    }).executeMainPageWithRetry({ Page: cdp.page, Runtime: cdp.runtime }, cdp.page, cdp.runtime);
    // Assert
    await expect(action).rejects.toThrow('final-failure');
  });

  it('whenMainPageFailsAndOriginErrorIsDetectedInCatch_executeMainPageWithRetry_shouldReloadInCatchBranch', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPreparation();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPreparation();
    mainPage.execute
      .mockRejectedValueOnce(new Error('attempt-failed'))
      .mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPreparation();
    const propertyList = new PropertyListPageServiceMockForPreparation();
    const originError = new OriginErrorDetectorServiceMockForPreparation();
    originError.hasOriginError
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const service = new SearchResultsPreparationService(
      new ChromeConfigMockForPreparation() as unknown as ChromeConfig,
      new ScraperConfigMockForPreparation() as unknown as ScraperConfig,
      sync as unknown as ChromiumPageSyncService,
      mainPage as unknown as MainPageService,
      filters as unknown as FiltersService,
      propertyList as unknown as PropertyListPageService,
      originError as unknown as OriginErrorDetectorService
    );
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    await (service as unknown as {
      executeMainPageWithRetry: (client: unknown, page: unknown, runtime: unknown) => Promise<void>;
    }).executeMainPageWithRetry({ Page: cdp.page, Runtime: cdp.runtime }, cdp.page, cdp.runtime);
    // Assert
    expect(cdp.page.reload as unknown as jest.Mock).toHaveBeenCalledWith({ ignoreCache: true });
  });

  it('whenOriginErrorPersists_recoverIfOriginError_shouldThrowAfterMaximumReloadAttempts', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPreparation();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPreparation();
    const filters = new FiltersServiceMockForPreparation();
    const propertyList = new PropertyListPageServiceMockForPreparation();
    const originError = new OriginErrorDetectorServiceMockForPreparation();
    originError.hasOriginError.mockResolvedValue(true);
    const service = new SearchResultsPreparationService(
      new ChromeConfigMockForPreparation() as unknown as ChromeConfig,
      new ScraperConfigMockForPreparation() as unknown as ScraperConfig,
      sync as unknown as ChromiumPageSyncService,
      mainPage as unknown as MainPageService,
      filters as unknown as FiltersService,
      propertyList as unknown as PropertyListPageService,
      originError as unknown as OriginErrorDetectorService
    );
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    const action = (service as unknown as {
      recoverIfOriginError: (page: unknown, runtime: unknown) => Promise<void>;
    }).recoverIfOriginError(cdp.page, cdp.runtime);
    // Assert
    await expect(action).rejects.toThrow('Origin error page persisted after automatic reload attempts.');
    expect((cdp.page.reload as unknown as jest.Mock)).toHaveBeenCalledTimes(3);
  });
});
