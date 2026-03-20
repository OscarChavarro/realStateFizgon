import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';

import type { SleepPort } from 'ports/outbound/timing/sleep.port';

type RuntimeDomainMock = {
  evaluate: jest.MockedFunction<
    (params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }) => Promise<{
      exceptionDetails?: { text?: string };
      result?: { value?: unknown };
    }>
  >;
};

type ExpressionRuntimeMock = {
  evaluate: jest.MockedFunction<
    (params: { expression: string; returnByValue?: boolean }) => Promise<{ result?: { value?: unknown } }>
  >;
};

function createService(): {
  service: ChromiumPageSyncService;
  sleepPort: jest.Mocked<SleepPort>;
  clockPort: { nowMs: jest.MockedFunction<() => number> };
} {
  const sleepPort: jest.Mocked<SleepPort> = {
    sleep: jest.fn(async () => undefined)
  };
  const clockPort = {
    nowMs: jest.fn<() => number>().mockReturnValue(0)
  };
  return {
    service: new ChromiumPageSyncService(sleepPort, clockPort as never),
    sleepPort,
    clockPort
  };
}

describe('ChromiumPageSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenDocumentIsAlreadyReady_waitForPageLoad_shouldResolveWithoutRegisteringLoadListener', async () => {
    // Arrange
    const { service, sleepPort } = createService();
    const page = { loadEventFired: jest.fn<(cb: () => void) => void>() };
    const runtime: RuntimeDomainMock = {
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    };
    // Action
    await service.waitForPageLoad(page, runtime);
    // Assert
    expect(page.loadEventFired).not.toHaveBeenCalled();
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenLoadEventFires_waitForPageLoad_shouldResolveAfterListenerCallback', async () => {
    // Arrange
    const { service, sleepPort } = createService();
    const page = {
      loadEventFired: jest.fn<(cb: () => void) => void>((callback) => callback())
    };
    // Action
    await service.waitForPageLoad(page);
    // Assert
    expect(page.loadEventFired).toHaveBeenCalledTimes(1);
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenDocumentBecomesReadyAfterListenerRegistration_waitForPageLoad_shouldResolveFromSecondReadinessCheck', async () => {
    // Arrange
    const { service, sleepPort } = createService();
    const page = { loadEventFired: jest.fn<(cb: () => void) => void>() };
    const evaluate: RuntimeDomainMock['evaluate'] = jest.fn();
    evaluate
      .mockResolvedValueOnce({ result: { value: false } })
      .mockResolvedValueOnce({ result: { value: true } });
    const runtime: RuntimeDomainMock = {
      evaluate
    };
    // Action
    await service.waitForPageLoad(page, runtime);
    // Assert
    expect(page.loadEventFired).toHaveBeenCalledTimes(1);
    expect(runtime.evaluate).toHaveBeenCalledTimes(2);
    expect(sleepPort.sleep).not.toHaveBeenCalled();
  });

  it('whenDocumentBecomesReadyDuringPolling_waitForPageLoad_shouldResolveFromLoopReadinessCheck', async () => {
    // Arrange
    const { service } = createService();
    const page = { loadEventFired: jest.fn<(cb: () => void) => void>() };
    const evaluate: RuntimeDomainMock['evaluate'] = jest.fn();
    evaluate
      .mockResolvedValueOnce({ result: { value: false } })
      .mockResolvedValueOnce({ result: { value: false } })
      .mockResolvedValueOnce({ result: { value: true } });
    const runtime: RuntimeDomainMock = {
      evaluate
    };
    // Action
    await service.waitForPageLoad(page, runtime, 2000, 100);
    // Assert
    expect(runtime.evaluate).toHaveBeenCalledTimes(3);
    expect(page.loadEventFired).toHaveBeenCalledTimes(1);
  });

  it('whenReadyCheckHasExceptionDetails_waitForPageLoad_shouldContinueUsingLoadEventSignal', async () => {
    // Arrange
    const { service } = createService();
    const page = {
      loadEventFired: jest.fn<(cb: () => void) => void>((callback) => callback())
    };
    const runtime: RuntimeDomainMock = {
      evaluate: jest.fn(async () => ({ exceptionDetails: { text: 'ReferenceError' } }))
    };
    // Action
    await service.waitForPageLoad(page, runtime);
    // Assert
    expect(runtime.evaluate).toHaveBeenCalled();
    expect(page.loadEventFired).toHaveBeenCalledTimes(1);
  });

  it('whenReadyCheckThrows_waitForPageLoad_shouldContinueUsingLoadEventSignal', async () => {
    // Arrange
    const { service } = createService();
    const page = {
      loadEventFired: jest.fn<(cb: () => void) => void>((callback) => callback())
    };
    const runtime: RuntimeDomainMock = {
      evaluate: jest.fn(async () => {
        throw new Error('CDP unavailable');
      })
    };
    // Action
    await service.waitForPageLoad(page, runtime);
    // Assert
    expect(runtime.evaluate).toHaveBeenCalled();
    expect(page.loadEventFired).toHaveBeenCalledTimes(1);
  });

  it('whenPageNeverLoads_waitForPageLoad_shouldThrowTimeoutError', async () => {
    // Arrange
    const { service, clockPort } = createService();
    const page = { loadEventFired: jest.fn<(cb: () => void) => void>() };
    const runtime: RuntimeDomainMock = {
      evaluate: jest.fn(async () => ({ result: { value: false } }))
    };
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.waitForPageLoad(page, runtime, 100, 10);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for page load after 1000ms.');
  });

  it('whenExpressionEventuallyMatches_waitForExpression_shouldResolveAfterPolling', async () => {
    // Arrange
    const { service, sleepPort } = createService();
    const evaluate: ExpressionRuntimeMock['evaluate'] = jest.fn();
    evaluate
      .mockResolvedValueOnce({ result: { value: false } })
      .mockResolvedValueOnce({ result: { value: false } })
      .mockResolvedValueOnce({ result: { value: true } });
    const runtime: ExpressionRuntimeMock = { evaluate };
    // Action
    await service.waitForExpression(runtime, 'window.ready === true', 5000, 100);
    // Assert
    expect(runtime.evaluate).toHaveBeenCalledTimes(3);
    expect(sleepPort.sleep).toHaveBeenCalledTimes(2);
  });

  it('whenExpressionNeverMatches_waitForExpression_shouldThrowTimeoutError', async () => {
    // Arrange
    const { service, clockPort } = createService();
    const runtime: ExpressionRuntimeMock = {
      evaluate: jest.fn(async () => ({ result: { value: false } }))
    };
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 400;
      return now;
    });
    // Action
    const action = service.waitForExpression(runtime, 'window.ready === true', 1000, 50);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for expression: window.ready === true');
  });

  it('whenSleepIsRequested_sleep_shouldDelegateToSleepPort', async () => {
    // Arrange
    const { service, sleepPort } = createService();
    // Action
    await service.sleep(250);
    // Assert
    expect(sleepPort.sleep).toHaveBeenCalledWith(250);
  });
});
