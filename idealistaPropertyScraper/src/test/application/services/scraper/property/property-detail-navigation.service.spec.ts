import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PropertyDetailNavigationService } from 'src/application/services/scraper/property/property-detail-navigation.service';
import { RuntimeClient } from 'src/application/services/scraper/property/runtime-client.type';
import { ChromeConfig } from 'src/infrastructure/config/settings/chrome.config';
import { sleep } from 'src/infrastructure/sleep';

jest.mock('src/infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

class ChromeConfigMockForDetailNavigation {
  readonly chromeCdpReadyTimeoutMs = 1000;
  readonly chromeCdpPollIntervalMs = 100;
}

function createRuntime(values: unknown[]): RuntimeClient {
  const evaluate = jest.fn<RuntimeClient['evaluate']>(async () => ({ result: { value: values.at(-1) } }));
  values.forEach((value) => {
    evaluate.mockImplementationOnce(async () => ({ result: { value } }));
  });
  return { evaluate };
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
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig
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
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig
    );
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 200;
      return now;
    });
    // Action
    await service.waitForDetailUrlAndDomComplete(runtime, 'https://www.idealista.com/inmueble/123/');
    // Assert
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it('whenTargetUrlNeverBecomesReady_waitForDetailUrlAndDomComplete_shouldThrowTimeoutError', async () => {
    // Arrange
    const runtime = createRuntime([false, false, false, false]);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig
    );
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.waitForDetailUrlAndDomComplete(runtime, 'https://www.idealista.com/inmueble/123/');
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for target URL to load: https://www.idealista.com/inmueble/123/');
    expect(sleep).toHaveBeenCalled();
  });

  it('whenDirectNavigationIsRequested_navigateDirectlyToUrl_shouldSetLocationAndWaitForCompletion', async () => {
    // Arrange
    const runtime = createRuntime([true]);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig
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
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig
    );
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 100;
      return now;
    });
    // Action
    await service.goBackToSearchResults(runtime);
    // Assert
    expect(runtime.evaluate).toHaveBeenNthCalledWith(1, expect.objectContaining({ expression: 'window.history.back(); true;' }));
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenSearchResultsNeverBecomeReady_goBackToSearchResults_shouldThrowTimeoutError', async () => {
    // Arrange
    const runtime = createRuntime([true, false, false, false, false]);
    const service = new PropertyDetailNavigationService(
      new ChromeConfigMockForDetailNavigation() as unknown as ChromeConfig
    );
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.goBackToSearchResults(runtime);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting to return to search results after detail processing.');
    expect(sleep).toHaveBeenCalled();
  });
});
