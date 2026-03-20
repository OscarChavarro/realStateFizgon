import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChromiumPageSyncService } from 'application/services/chromium/chromium-page-sync.service';
import { sleep } from 'infrastructure/sleep';

jest.mock('infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

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

describe('ChromiumPageSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenDocumentIsAlreadyReady_waitForPageLoad_shouldResolveWithoutRegisteringLoadListener', async () => {
    // Arrange
    const service = new ChromiumPageSyncService();
    const page = { loadEventFired: jest.fn<(cb: () => void) => void>() };
    const runtime: RuntimeDomainMock = {
      evaluate: jest.fn(async () => ({ result: { value: true } }))
    };
    // Action
    await service.waitForPageLoad(page, runtime);
    // Assert
    expect(page.loadEventFired).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenLoadEventFires_waitForPageLoad_shouldResolveAfterListenerCallback', async () => {
    // Arrange
    const service = new ChromiumPageSyncService();
    const page = {
      loadEventFired: jest.fn<(cb: () => void) => void>((callback) => callback())
    };
    // Action
    await service.waitForPageLoad(page);
    // Assert
    expect(page.loadEventFired).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenDocumentBecomesReadyAfterListenerRegistration_waitForPageLoad_shouldResolveFromSecondReadinessCheck', async () => {
    // Arrange
    const service = new ChromiumPageSyncService();
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
    expect(sleep).not.toHaveBeenCalled();
  });

  it('whenDocumentBecomesReadyDuringPolling_waitForPageLoad_shouldResolveFromLoopReadinessCheck', async () => {
    // Arrange
    const service = new ChromiumPageSyncService();
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
    const service = new ChromiumPageSyncService();
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
    const service = new ChromiumPageSyncService();
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
    const service = new ChromiumPageSyncService();
    const page = { loadEventFired: jest.fn<(cb: () => void) => void>() };
    const runtime: RuntimeDomainMock = {
      evaluate: jest.fn(async () => ({ result: { value: false } }))
    };
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    const action = service.waitForPageLoad(page, runtime, 100, 10);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for page load after 1000ms.');
    nowSpy.mockRestore();
  });

  it('whenExpressionEventuallyMatches_waitForExpression_shouldResolveAfterPolling', async () => {
    // Arrange
    const service = new ChromiumPageSyncService();
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
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('whenExpressionNeverMatches_waitForExpression_shouldThrowTimeoutError', async () => {
    // Arrange
    const service = new ChromiumPageSyncService();
    const runtime: ExpressionRuntimeMock = {
      evaluate: jest.fn(async () => ({ result: { value: false } }))
    };
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 400;
      return now;
    });
    // Action
    const action = service.waitForExpression(runtime, 'window.ready === true', 1000, 50);
    // Assert
    await expect(action).rejects.toThrow('Timeout waiting for expression: window.ready === true');
    nowSpy.mockRestore();
  });

  it('whenSleepIsRequested_sleep_shouldDelegateToInfrastructureSleep', async () => {
    // Arrange
    const service = new ChromiumPageSyncService();
    // Action
    await service.sleep(250);
    // Assert
    expect(sleep).toHaveBeenCalledWith(250);
  });
});
