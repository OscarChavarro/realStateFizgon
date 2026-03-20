import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { FilterLoaderDetectionService } from 'application/services/scraper/filters/filter-loader-detection.service';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { sleep } from 'infrastructure/sleep';

import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
jest.mock('infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

class ScraperConfigMockForLoader {
  readonly filterStateClickWaitMs = 50;
  readonly filterListingLoadingTimeoutMs = 1000;
  readonly filterListingLoadingPollIntervalMs = 100;
}

class ChromiumPageSyncServiceMockForLoader {
  readonly waitForPageLoad = jest.fn<(page: unknown, runtime: unknown, timeout: number, poll: number) => Promise<void>>();
}

function createClient(evaluate: FiltersCdpClient['Runtime']['evaluate']): FiltersCdpClient {
  return {
    Runtime: {
      enable: jest.fn(async () => undefined),
      evaluate
    },
    Page: {
      reload: jest.fn(async () => undefined),
      loadEventFired: jest.fn()
    }
  };
}

describe('FilterLoaderDetectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenListingLoaderDisappears_waitForPostClickStabilityOrReload_shouldReturnTrueWithoutReload', async () => {
    // Arrange
    const pageSync = new ChromiumPageSyncServiceMockForLoader();
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const evaluate = jest.fn(async () => ({ result: { value: false } }));
    const client = createClient(evaluate);
    // Action
    const result = await service.waitForPostClickStabilityOrReload(client);
    // Assert
    expect(result).toBe(true);
    expect(client.Page.reload).not.toHaveBeenCalled();
    expect(pageSync.waitForPageLoad).not.toHaveBeenCalled();
  });

  it('whenListingLoaderStaysVisible_waitForPostClickStabilityOrReload_shouldReloadAndReturnFalse', async () => {
    // Arrange
    const pageSync = new ChromiumPageSyncServiceMockForLoader();
    pageSync.waitForPageLoad.mockResolvedValue(undefined);
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const evaluate = jest.fn<FiltersCdpClient['Runtime']['evaluate']>(async () => ({ result: { value: true } }));
    [true, true, true, true, true, true, true, true, false].forEach((value) => {
      evaluate.mockImplementationOnce(async () => ({ result: { value } }));
    });
    const client = createClient(evaluate);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const result = await service.waitForPostClickStabilityOrReload(client);
    // Assert
    expect(result).toBe(false);
    expect(client.Page.reload).toHaveBeenCalledWith({ ignoreCache: true });
    expect(pageSync.waitForPageLoad).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it('whenScrollToTopFails_scrollToTop_shouldThrowError', async () => {
    // Arrange
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      new ChromiumPageSyncServiceMockForLoader() as unknown as ChromiumPageSyncService
    );
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'boom' } })));
    // Action
    const action = service.scrollToTop(client);
    // Assert
    await expect(action).rejects.toThrow('boom');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenScrollToTopSucceeds_scrollToTop_shouldResolveWithoutError', async () => {
    // Arrange
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      new ChromiumPageSyncServiceMockForLoader() as unknown as ChromiumPageSyncService
    );
    const evaluate = jest.fn(async () => ({ result: { value: true } }));
    const client = createClient(evaluate);
    // Action
    const action = service.scrollToTop(client);
    // Assert
    await expect(action).resolves.toBeUndefined();
  });

  it('whenListingVisibilityEvaluationFails_waitForPostClickStabilityOrReload_shouldPropagateError', async () => {
    // Arrange
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      new ChromiumPageSyncServiceMockForLoader() as unknown as ChromiumPageSyncService
    );
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: 'listing-error' } })));
    // Action
    const action = service.waitForPostClickStabilityOrReload(client);
    // Assert
    await expect(action).rejects.toThrow('listing-error');
  });

  it('whenAsideFiltersNeverAppearAfterReload_waitForPostClickStabilityOrReload_shouldThrowTimeoutError', async () => {
    // Arrange
    const pageSync = new ChromiumPageSyncServiceMockForLoader();
    pageSync.waitForPageLoad.mockResolvedValue(undefined);
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const evaluate = jest.fn<FiltersCdpClient['Runtime']['evaluate']>()
      .mockResolvedValueOnce({ result: { value: true } })
      .mockResolvedValueOnce({ result: { value: true } })
      .mockResolvedValue({ result: { value: false } });
    const client = createClient(evaluate);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.waitForPostClickStabilityOrReload(client);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for #aside-filters after reload.');
    nowSpy.mockRestore();
  });

  it('whenAsideFilterProbeReturnsException_waitForPostClickStabilityOrReload_shouldThrowProbeError', async () => {
    // Arrange
    const pageSync = new ChromiumPageSyncServiceMockForLoader();
    pageSync.waitForPageLoad.mockResolvedValue(undefined);
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const evaluate = jest.fn<FiltersCdpClient['Runtime']['evaluate']>()
      .mockResolvedValueOnce({ result: { value: true } })
      .mockResolvedValueOnce({ result: { value: true } })
      .mockResolvedValueOnce({ exceptionDetails: { text: 'aside-probe-error' } });
    const client = createClient(evaluate);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.waitForPostClickStabilityOrReload(client);
    // Assert
    await expect(action).rejects.toThrow('aside-probe-error');
    nowSpy.mockRestore();
  });

  it('whenAsideFilterProbeHasEmptyExceptionText_waitForAsideFilters_shouldIgnoreExceptionObjectAndReturn', async () => {
    // Arrange
    const service = new FilterLoaderDetectionService(
      new ScraperConfigMockForLoader() as unknown as ScraperConfig,
      new ChromiumPageSyncServiceMockForLoader() as unknown as ChromiumPageSyncService
    );
    const client = createClient(jest.fn(async () => ({ exceptionDetails: { text: '' }, result: { value: true } })));
    // Action
    const action = (service as unknown as { waitForAsideFilters: (value: FiltersCdpClient) => Promise<void> }).waitForAsideFilters(client);
    // Assert
    await expect(action).resolves.toBeUndefined();
  });
});
