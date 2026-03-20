import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailNavigationService } from 'application/services/scraper/property/property-detail-navigation.service';
import { ChromeConfig } from 'infrastructure/config/settings/chrome.config';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';

class ChromeConfigMockForDetailNavigation {
  readonly chromeCdpReadyTimeoutMs = 1000;
  readonly chromeCdpPollIntervalMs = 100;
}

type SleepPortMock = {
  sleep: jest.Mock<(ms: number) => Promise<void>>;
};

function createRuntime(values: unknown[]): RuntimeClient {
  const evaluate = jest.fn<RuntimeClient['evaluate']>(async () => ({ result: { value: values.at(-1) } }));
  values.forEach((value) => {
    evaluate.mockImplementationOnce(async () => ({ result: { value } }));
  });
  return { evaluate };
}

function createSleepPort(): SleepPortMock {
  return {
    sleep: jest.fn(async () => undefined)
  };
}

function createClockPort(initial = 0): { nowMs: jest.MockedFunction<() => number> } {
  return {
    nowMs: jest.fn<() => number>().mockReturnValue(initial)
  };
}

describe('PropertyDetailNavigationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenPropertyIsVisible_clickPropertyLinkFromResults_shouldReturnTrue', async () => {
    // Arrange
    const runtime = createRuntime([true]);
    const sleepPort = createSleepPort();
    const clockPort = createClockPort(0);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig,
      clockPort as never,
      sleepPort as never
    );
    // Action
    const clicked = await service.clickPropertyLinkFromResults(runtime, 'https://www.idealista.com/inmueble/123/');
    // Assert
    expect(clicked).toBe(true);
    expect(runtime.evaluate).toHaveBeenCalledWith(expect.objectContaining({ returnByValue: true }));
  });

  it('whenTargetUrlBecomesReady_waitForDetailUrlAndDomComplete_shouldWaitUntilReady', async () => {
    // Arrange
    const runtime = createRuntime([false, true]);
    const sleepPort = createSleepPort();
    const clockPort = createClockPort(0);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig,
      clockPort as never,
      sleepPort as never
    );
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 200;
      return now;
    });
    // Action
    await service.waitForDetailUrlAndDomComplete(runtime, 'https://www.idealista.com/inmueble/123/');
    // Assert
    expect(sleepPort.sleep).toHaveBeenCalledTimes(1);
    expect(sleepPort.sleep).toHaveBeenCalledWith(100);
  });

  it('whenTargetUrlNeverBecomesReady_waitForDetailUrlAndDomComplete_shouldThrowTimeoutError', async () => {
    // Arrange
    const runtime = createRuntime([false, false, false, false]);
    const sleepPort = createSleepPort();
    const clockPort = createClockPort(0);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig,
      clockPort as never,
      sleepPort as never
    );
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.waitForDetailUrlAndDomComplete(runtime, 'https://www.idealista.com/inmueble/123/');
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for target URL to load: https://www.idealista.com/inmueble/123/');
    expect(sleepPort.sleep).toHaveBeenCalled();
  });

  it('whenDirectNavigationIsRequested_navigateDirectlyToUrl_shouldSetLocationAndWaitForCompletion', async () => {
    // Arrange
    const runtime = createRuntime([true]);
    const sleepPort = createSleepPort();
    const clockPort = createClockPort(0);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig,
      clockPort as never,
      sleepPort as never
    );
    const waitSpy = jest.spyOn(
      service as unknown as { waitForDetailUrlAndDomComplete: (runtimeArg: RuntimeClient, targetUrl: string) => Promise<void> },
      'waitForDetailUrlAndDomComplete'
    ).mockResolvedValue(undefined);
    // Action
    await service.navigateDirectlyToUrl(runtime, 'https://www.idealista.com/inmueble/999/');
    // Assert
    expect(runtime.evaluate).toHaveBeenCalledWith(expect.objectContaining({ expression: 'window.location.href = "https://www.idealista.com/inmueble/999/"; true;' }));
    expect(waitSpy).toHaveBeenCalledWith(runtime, 'https://www.idealista.com/inmueble/999/');
  });

  it('whenSearchResultsAreReady_goBackToSearchResults_shouldReturnAfterHistoryBack', async () => {
    // Arrange
    const runtime = createRuntime([true, true]);
    const sleepPort = createSleepPort();
    const clockPort = createClockPort(0);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig,
      clockPort as never,
      sleepPort as never
    );
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 100;
      return now;
    });
    // Action
    await service.goBackToSearchResults(runtime);
    // Assert
    expect(runtime.evaluate).toHaveBeenNthCalledWith(1, expect.objectContaining({ expression: 'window.history.back(); true;' }));
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenSearchResultsNeverBecomeReady_goBackToSearchResults_shouldThrowTimeoutError', async () => {
    // Arrange
    const runtime = createRuntime([true, false, false, false, false]);
    const sleepPort = createSleepPort();
    const clockPort = createClockPort(0);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig,
      clockPort as never,
      sleepPort as never
    );
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.goBackToSearchResults(runtime);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting to return to search results after detail processing.');
    expect(sleepPort.sleep).toHaveBeenCalled();
  });
});
