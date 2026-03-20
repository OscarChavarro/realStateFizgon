import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CDP = require('chrome-remote-interface');
import { ChromiumPageTargetService } from 'application/services/chromium/chromium-page-target.service';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';

jest.mock('chrome-remote-interface', () => ({
  List: jest.fn()
}));

class ChromeConfigMock {
  constructor(
    public readonly chromeCdpReadyTimeoutMs: number,
    public readonly chromeCdpPollIntervalMs: number
  ) {}
}

class ScraperConfigMockForTarget {
  constructor(public readonly scraperHomeUrl: string) {}
}

class ChromiumPageSyncServiceMock {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

type CdpListMock = jest.MockedFunction<
  (params: { host: string; port: number }) => Promise<Array<{ id: string; type?: string; url?: string }>>
>;

describe('ChromiumPageTargetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenHomeTargetExists_waitForPageTarget_shouldReturnPreferredHomeTarget', async () => {
    // Arrange
    const chrome = new ChromeConfigMock(5000, 100);
    const scraper = new ScraperConfigMockForTarget('https://www.idealista.com/venta-viviendas/');
    const pageSync = new ChromiumPageSyncServiceMock();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumPageTargetService(
      chrome as unknown as ChromeConfig,
      scraper as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const listMock = CDP.List as unknown as CdpListMock;
    listMock.mockResolvedValue([
      { id: 'devtools', type: 'page', url: 'devtools://devtools/bundled/inspector.html' },
      { id: 'search', type: 'page', url: 'https://www.idealista.com/venta-viviendas/' },
      { id: 'other', type: 'page', url: 'https://www.example.com/' }
    ]);
    // Action
    const target = await service.waitForPageTarget('127.0.0.1', 9222);
    // Assert
    expect(target?.id).toBe('search');
    expect(pageSync.sleep).not.toHaveBeenCalled();
  });

  it('whenHomeTargetDoesNotExist_waitForPageTarget_shouldReturnFirstEligiblePageTarget', async () => {
    // Arrange
    const chrome = new ChromeConfigMock(5000, 100);
    const scraper = new ScraperConfigMockForTarget('https://www.idealista.com/venta-viviendas/');
    const pageSync = new ChromiumPageSyncServiceMock();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumPageTargetService(
      chrome as unknown as ChromeConfig,
      scraper as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const listMock = CDP.List as unknown as CdpListMock;
    listMock.mockResolvedValue([
      { id: 'first', type: 'page', url: 'https://www.example.com/' },
      { id: 'second', type: 'page', url: 'https://www.idealista.com/not-home' }
    ]);
    // Action
    const target = await service.waitForPageTarget('127.0.0.1', 9222);
    // Assert
    expect(target?.id).toBe('first');
    expect(pageSync.sleep).not.toHaveBeenCalled();
  });

  it('whenPageTargetsContainUndefinedUrls_waitForPageTarget_shouldFallbackToEmptyStringWithoutCrashing', async () => {
    // Arrange
    const chrome = new ChromeConfigMock(5000, 100);
    const scraper = new ScraperConfigMockForTarget('https://www.idealista.com/venta-viviendas/');
    const pageSync = new ChromiumPageSyncServiceMock();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumPageTargetService(
      chrome as unknown as ChromeConfig,
      scraper as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const listMock = CDP.List as unknown as CdpListMock;
    listMock.mockResolvedValue([
      { id: 'blank', type: 'page', url: undefined },
      { id: 'home', type: 'page', url: 'https://www.idealista.com/venta-viviendas/' }
    ]);
    // Action
    const target = await service.waitForPageTarget('127.0.0.1', 9222);
    // Assert
    expect(target?.id).toBe('home');
    expect(pageSync.sleep).not.toHaveBeenCalled();
  });

  it('whenOnlyDevtoolsPageIsAvailable_waitForPageTarget_shouldFallbackToLastPageInRawTargets', async () => {
    // Arrange
    const chrome = new ChromeConfigMock(5000, 100);
    const scraper = new ScraperConfigMockForTarget('https://www.idealista.com/venta-viviendas/');
    const pageSync = new ChromiumPageSyncServiceMock();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumPageTargetService(
      chrome as unknown as ChromeConfig,
      scraper as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const listMock = CDP.List as unknown as CdpListMock;
    listMock.mockResolvedValue([
      { id: 'worker', type: 'service_worker', url: 'https://www.idealista.com/' },
      { id: 'devtools-page', type: 'page', url: 'devtools://devtools/bundled/inspector.html' }
    ]);
    // Action
    const target = await service.waitForPageTarget('127.0.0.1', 9222);
    // Assert
    expect(target?.id).toBe('devtools-page');
    expect(pageSync.sleep).not.toHaveBeenCalled();
  });

  it('whenNoPageTargetAppears_waitForPageTarget_shouldReturnUndefinedAfterTimeout', async () => {
    // Arrange
    const chrome = new ChromeConfigMock(1000, 50);
    const scraper = new ScraperConfigMockForTarget('https://www.idealista.com/venta-viviendas/');
    const pageSync = new ChromiumPageSyncServiceMock();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumPageTargetService(
      chrome as unknown as ChromeConfig,
      scraper as unknown as ScraperConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const listMock = CDP.List as unknown as CdpListMock;
    listMock.mockResolvedValue([]);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const target = await service.waitForPageTarget('127.0.0.1', 9222);
    // Assert
    expect(target).toBeUndefined();
    expect(pageSync.sleep).toHaveBeenCalledWith(50);
    nowSpy.mockRestore();
  });
});
