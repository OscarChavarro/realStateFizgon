import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChromiumCdpReadinessService } from 'src/application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumPageSyncService } from 'src/application/services/chromium/chromium-page-sync.service';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';

class ChromeConfigMockForReadiness {
  constructor(
    public readonly chromeCdpReadyTimeoutMs: number,
    public readonly chromeCdpRequestTimeoutMs: number,
    public readonly chromeCdpPollIntervalMs: number
  ) {}
}

class ChromiumPageSyncServiceMockForReadiness {
  readonly sleep = jest.fn<(ms: number) => Promise<void>>();
}

describe('ChromiumCdpReadinessService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenReadyEndpointRespondsOk_waitForReadyEndpoint_shouldResolveWithoutSleeping', async () => {
    // Arrange
    const chrome = new ChromeConfigMockForReadiness(5000, 200, 100);
    const pageSync = new ChromiumPageSyncServiceMockForReadiness();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumCdpReadinessService(
      chrome as unknown as ChromeConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true
    } as Response);
    global.fetch = fetchMock;
    // Action
    await service.waitForReadyEndpoint('127.0.0.1', 9222);
    // Assert
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9222/json/version', expect.objectContaining({
      signal: expect.any(AbortSignal)
    }));
    expect(pageSync.sleep).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it('whenEndpointFailsThenRecovers_waitForReadyEndpoint_shouldPollUntilSuccess', async () => {
    // Arrange
    const chrome = new ChromeConfigMockForReadiness(5000, 200, 100);
    const pageSync = new ChromiumPageSyncServiceMockForReadiness();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumCdpReadinessService(
      chrome as unknown as ChromeConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    global.fetch = fetchMock;
    // Action
    await service.waitForReadyEndpoint('127.0.0.1', 9222);
    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pageSync.sleep).toHaveBeenCalledWith(100);
    global.fetch = originalFetch;
  });

  it('whenEndpointNeverBecomesReady_waitForReadyEndpoint_shouldThrowTimeoutError', async () => {
    // Arrange
    const chrome = new ChromeConfigMockForReadiness(1000, 200, 50);
    const pageSync = new ChromiumPageSyncServiceMockForReadiness();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumCdpReadinessService(
      chrome as unknown as ChromeConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const fetchMock = jest.fn<typeof fetch>().mockRejectedValue(new Error('connect ECONNREFUSED'));
    global.fetch = fetchMock;
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.waitForReadyEndpoint('127.0.0.1', 9222);
    // Assert
    await expect(action).rejects.toThrow('CDP endpoint did not become available in time');
    expect(pageSync.sleep).toHaveBeenCalledWith(50);
    nowSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it('whenEndpointKeepsRespondingNotOk_waitForReadyEndpoint_shouldThrowTimeoutWithoutLastErrorDetails', async () => {
    // Arrange
    const chrome = new ChromeConfigMockForReadiness(500, 200, 50);
    const pageSync = new ChromiumPageSyncServiceMockForReadiness();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumCdpReadinessService(
      chrome as unknown as ChromeConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({ ok: false } as Response);
    global.fetch = fetchMock;
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 300;
      return now;
    });
    // Action
    const action = service.waitForReadyEndpoint('127.0.0.1', 9222);
    // Assert
    await expect(action).rejects.toThrow('CDP endpoint did not become available in time at 127.0.0.1:9222');
    await expect(action).rejects.not.toThrow('(');
    nowSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it('whenRequestHangs_waitForReadyEndpoint_shouldAbortRequestByTimeoutCallback', async () => {
    // Arrange
    jest.useFakeTimers();
    const chrome = new ChromeConfigMockForReadiness(120, 50, 10);
    const pageSync = new ChromiumPageSyncServiceMockForReadiness();
    pageSync.sleep.mockResolvedValue(undefined);
    const service = new ChromiumCdpReadinessService(
      chrome as unknown as ChromeConfig,
      pageSync as unknown as ChromiumPageSyncService
    );
    const fetchMock = jest.fn<typeof fetch>((_, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal;
        signal.addEventListener('abort', () => reject(new Error('aborted by timeout')));
      })
    );
    global.fetch = fetchMock;
    // Action
    const action = service.waitForReadyEndpoint('127.0.0.1', 9222);
    const assertion = expect(action).rejects.toThrow('aborted by timeout');
    await jest.advanceTimersByTimeAsync(200);
    // Assert
    await assertion;
    jest.useRealTimers();
    global.fetch = originalFetch;
  });
});
