import { describe, expect, it, jest } from '@jest/globals';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { OriginErrorDetectorService } from 'src/application/services/resilience/origin-error-detector.service';
import { FiltersService } from 'src/application/services/scraper/filters/filters.service';
import { MainPageService } from 'src/application/services/scraper/main-page.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { PrepareSearchResultsUseCase } from 'src/application/usecases/scraper/prepare-search-results.use-case';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import type { ErrorMessagePort } from 'src/ports/outbound/observability/error-message.port';

class ChromeConfigMockForPrepareSearchResultsUseCase {
  readonly chromeCdpReadyTimeoutMs = 1000;
  readonly chromeCdpPollIntervalMs = 50;
  readonly chromeExpressionTimeoutMs = 1000;
  readonly chromeExpressionPollIntervalMs = 50;
  readonly chromeOriginErrorReloadWaitMs = 10;
}

class ScraperConfigMockForPrepareSearchResultsUseCase {
  readonly scraperHomeUrl = 'https://www.idealista.com/';
  readonly mainPageFirstLoadDeviceVerificationWaitMs = 10;
  readonly mainSearchArea = 'Madrid';
}

class ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase {
  readonly waitForPageLoad = jest.fn<(page: unknown, runtime: unknown, timeout: number, poll: number) => Promise<void>>();
  readonly waitForExpression = jest.fn<(runtime: unknown, expression: string, timeout: number, poll: number) => Promise<void>>();
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

class MainPageServiceMockForPrepareSearchResultsUseCase {
  readonly execute = jest.fn<(client: unknown, mainSearchArea: string, homeUrl: string) => Promise<void>>();
}

class FiltersServiceMockForPrepareSearchResultsUseCase {
  readonly execute = jest.fn<(client: unknown) => Promise<void>>();
}

class PropertyListPageServiceMockForPrepareSearchResultsUseCase {
  readonly resetProcessedUrlsForCurrentSearch = jest.fn<() => void>();
}

class OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase {
  readonly hasOriginError = jest.fn<(runtime: unknown) => Promise<boolean>>();
}

class ErrorMessagePortMockForPrepareSearchResultsUseCase implements ErrorMessagePort {
  readonly toErrorMessage = jest.fn<(error: unknown) => string>();
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

function createUseCase(dependencies: {
  sync: ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase;
  mainPage: MainPageServiceMockForPrepareSearchResultsUseCase;
  filters: FiltersServiceMockForPrepareSearchResultsUseCase;
  propertyList: PropertyListPageServiceMockForPrepareSearchResultsUseCase;
  originError: OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase;
}): { useCase: PrepareSearchResultsUseCase; errorMessagePort: ErrorMessagePortMockForPrepareSearchResultsUseCase } {
  const errorMessagePort = new ErrorMessagePortMockForPrepareSearchResultsUseCase();
  errorMessagePort.toErrorMessage.mockImplementation((error: unknown) =>
    error instanceof Error ? error.message : String(error)
  );
  const useCase = new PrepareSearchResultsUseCase(
    new ChromeConfigMockForPrepareSearchResultsUseCase() as unknown as ChromeConfig,
    new ScraperConfigMockForPrepareSearchResultsUseCase() as unknown as ScraperConfig,
    dependencies.sync as unknown as ChromiumPageSyncService,
    dependencies.mainPage as unknown as MainPageService,
    dependencies.filters as unknown as FiltersService,
    dependencies.propertyList as unknown as PropertyListPageService,
    dependencies.originError as unknown as OriginErrorDetectorService,
    errorMessagePort
  );
  return { useCase, errorMessagePort };
}

describe('PrepareSearchResultsUseCase', () => {
  it('whenCurrentPageIsNotHome_execute_shouldNavigateHomeAndContinueFlow', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPrepareSearchResultsUseCase();
    mainPage.execute.mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPrepareSearchResultsUseCase();
    filters.execute.mockResolvedValue(undefined);
    const propertyList = new PropertyListPageServiceMockForPrepareSearchResultsUseCase();
    const originError = new OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase();
    originError.hasOriginError.mockResolvedValue(false);
    const { useCase } = createUseCase({ sync, mainPage, filters, propertyList, originError });
    const cdp = createPageAndRuntime('https://other-page.local/');
    // Action
    await useCase.execute({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    // Assert
    expect(cdp.page.navigate as unknown as jest.Mock).toHaveBeenCalledWith({ url: 'https://www.idealista.com/' });
    expect(sync.waitForPageLoad).toHaveBeenCalled();
    expect(filters.execute).toHaveBeenCalled();
  });

  it('whenPreparationRunsTwice_execute_shouldApplyFirstHomePageWaitOnlyOnce', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPrepareSearchResultsUseCase();
    mainPage.execute.mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPrepareSearchResultsUseCase();
    filters.execute.mockResolvedValue(undefined);
    const propertyList = new PropertyListPageServiceMockForPrepareSearchResultsUseCase();
    const originError = new OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase();
    originError.hasOriginError.mockResolvedValue(false);
    const { useCase } = createUseCase({ sync, mainPage, filters, propertyList, originError });
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    await useCase.execute({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    await useCase.execute({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    // Assert
    expect(sync.sleep).toHaveBeenCalledTimes(1);
    expect(propertyList.resetProcessedUrlsForCurrentSearch).toHaveBeenCalledTimes(4);
  });

  it('whenLocationEvaluateReturnsNoValue_execute_shouldFallbackToEmptyCurrentUrlAndNavigateHome', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPrepareSearchResultsUseCase();
    mainPage.execute.mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPrepareSearchResultsUseCase();
    filters.execute.mockResolvedValue(undefined);
    const propertyList = new PropertyListPageServiceMockForPrepareSearchResultsUseCase();
    const originError = new OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase();
    originError.hasOriginError.mockResolvedValue(false);
    const { useCase } = createUseCase({ sync, mainPage, filters, propertyList, originError });
    const cdp = createPageAndRuntimeWithoutLocationResult();
    // Action
    await useCase.execute({ Page: cdp.page, Runtime: cdp.runtime } as never, cdp.page, cdp.runtime);
    // Assert
    expect(cdp.page.navigate as unknown as jest.Mock).toHaveBeenCalledWith({ url: 'https://www.idealista.com/' });
    expect(filters.execute).toHaveBeenCalled();
  });

  it('whenMainPageFailsAndOriginErrorIsVisible_executeMainPageWithRetry_shouldReloadAndRetry', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPrepareSearchResultsUseCase();
    mainPage.execute
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPrepareSearchResultsUseCase();
    const propertyList = new PropertyListPageServiceMockForPrepareSearchResultsUseCase();
    const originError = new OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase();
    originError.hasOriginError
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const { useCase } = createUseCase({ sync, mainPage, filters, propertyList, originError });
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    await (useCase as unknown as {
      executeMainPageWithRetry: (client: unknown, page: unknown, runtime: unknown) => Promise<void>;
    }).executeMainPageWithRetry({ Page: cdp.page, Runtime: cdp.runtime }, cdp.page, cdp.runtime);
    // Assert
    expect(cdp.page.reload as unknown as jest.Mock).toHaveBeenCalledWith({ ignoreCache: true });
    expect(mainPage.execute).toHaveBeenCalledTimes(2);
    expect(sync.sleep).toHaveBeenCalled();
  });

  it('whenMainPageFailsOnLastRetry_executeMainPageWithRetry_shouldThrowOriginalError', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPrepareSearchResultsUseCase();
    mainPage.execute.mockRejectedValue(new Error('final-failure'));
    const filters = new FiltersServiceMockForPrepareSearchResultsUseCase();
    const propertyList = new PropertyListPageServiceMockForPrepareSearchResultsUseCase();
    const originError = new OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase();
    originError.hasOriginError.mockResolvedValue(false);
    const { useCase } = createUseCase({ sync, mainPage, filters, propertyList, originError });
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    const action = (useCase as unknown as {
      executeMainPageWithRetry: (client: unknown, page: unknown, runtime: unknown) => Promise<void>;
    }).executeMainPageWithRetry({ Page: cdp.page, Runtime: cdp.runtime }, cdp.page, cdp.runtime);
    // Assert
    await expect(action).rejects.toThrow('final-failure');
  });

  it('whenMainPageFailsAndOriginErrorIsDetectedInCatch_executeMainPageWithRetry_shouldReloadInCatchBranch', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPrepareSearchResultsUseCase();
    mainPage.execute
      .mockRejectedValueOnce(new Error('attempt-failed'))
      .mockResolvedValue(undefined);
    const filters = new FiltersServiceMockForPrepareSearchResultsUseCase();
    const propertyList = new PropertyListPageServiceMockForPrepareSearchResultsUseCase();
    const originError = new OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase();
    originError.hasOriginError
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const { useCase, errorMessagePort } = createUseCase({ sync, mainPage, filters, propertyList, originError });
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    await (useCase as unknown as {
      executeMainPageWithRetry: (client: unknown, page: unknown, runtime: unknown) => Promise<void>;
    }).executeMainPageWithRetry({ Page: cdp.page, Runtime: cdp.runtime }, cdp.page, cdp.runtime);
    // Assert
    expect(errorMessagePort.toErrorMessage).toHaveBeenCalledWith(expect.any(Error));
    expect(cdp.page.reload as unknown as jest.Mock).toHaveBeenCalledWith({ ignoreCache: true });
  });

  it('whenOriginErrorPersists_recoverIfOriginError_shouldThrowAfterMaximumReloadAttempts', async () => {
    // Arrange
    const sync = new ChromiumPageSyncServiceMockForPrepareSearchResultsUseCase();
    sync.waitForPageLoad.mockResolvedValue(undefined);
    sync.waitForExpression.mockResolvedValue(undefined);
    sync.sleep.mockResolvedValue(undefined);
    const mainPage = new MainPageServiceMockForPrepareSearchResultsUseCase();
    const filters = new FiltersServiceMockForPrepareSearchResultsUseCase();
    const propertyList = new PropertyListPageServiceMockForPrepareSearchResultsUseCase();
    const originError = new OriginErrorDetectorServiceMockForPrepareSearchResultsUseCase();
    originError.hasOriginError.mockResolvedValue(true);
    const { useCase } = createUseCase({ sync, mainPage, filters, propertyList, originError });
    const cdp = createPageAndRuntime('https://www.idealista.com/');
    // Action
    const action = (useCase as unknown as {
      recoverIfOriginError: (page: unknown, runtime: unknown) => Promise<void>;
    }).recoverIfOriginError(cdp.page, cdp.runtime);
    // Assert
    await expect(action).rejects.toThrow('Origin error page persisted after automatic reload attempts.');
    expect((cdp.page.reload as unknown as jest.Mock)).toHaveBeenCalledTimes(3);
  });
});
