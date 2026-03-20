import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import { NetworkDomain } from 'application/services/imagedownload/network-domain.type';
import { sleep } from 'infrastructure/sleep';

jest.mock('infrastructure/sleep', () => ({
  sleep: jest.fn(async () => undefined)
}));

class LoggerMock {
  readonly warn = jest.fn<(message: string) => void>();
}

describe('ImageNetworkCaptureService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenClientIsMarkedInitialized_isInitialized_shouldReturnTrue', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    const client = {};
    service.markInitialized(client);
    // Action
    const initialized = service.isInitialized(client);
    // Assert
    expect(initialized).toBe(true);
  });

  it('whenResponseIsNotTrackable_trackResponseReceived_shouldIgnoreRequest', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    service.trackResponseReceived({
      requestId: 'r1',
      type: 'document',
      response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    // Action
    const pendingSize = (service as unknown as { pendingImageRequests: Map<string, unknown> }).pendingImageRequests.size;
    // Assert
    expect(pendingSize).toBe(0);
  });

  it('whenResponseTypeIsMissing_trackResponseReceived_shouldFallbackToEmptyTypeAndIgnoreRequest', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    // Action
    service.trackResponseReceived({
      requestId: 'r-missing-type',
      type: undefined,
      response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    // Assert
    const pendingSize = (service as unknown as { pendingImageRequests: Map<string, unknown> }).pendingImageRequests.size;
    expect(pendingSize).toBe(0);
  });

  it('whenResponseDomainIsNotAllowed_trackResponseReceived_shouldIgnoreRequest', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    // Action
    service.trackResponseReceived({
      requestId: 'r1-denied',
      type: 'image',
      response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
    }, () => false);
    // Assert
    const pendingSize = (service as unknown as { pendingImageRequests: Map<string, unknown> }).pendingImageRequests.size;
    expect(pendingSize).toBe(0);
  });

  it('whenResponseIsImageFromAllowedDomain_trackResponseReceived_shouldStorePendingRequest', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    // Action
    service.trackResponseReceived({
      requestId: 'r2',
      type: 'image',
      response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    // Assert
    const pending = (service as unknown as { pendingImageRequests: Map<string, { url: string }> }).pendingImageRequests.get('r2');
    expect(pending?.url).toBe('https://img4.idealista.com/blur/a.jpg');
  });

  it('whenResponseUrlAndMimeTypeAreMissing_trackResponseReceived_shouldFallbackToEmptyStrings', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    // Action
    service.trackResponseReceived({
      requestId: 'r-empty',
      type: 'image',
      response: { url: undefined as unknown as string, mimeType: undefined }
    }, () => true);
    // Assert
    const pending = (service as unknown as { pendingImageRequests: Map<string, { url: string; mimeType: string }> }).pendingImageRequests.get('r-empty');
    expect(pending).toEqual({ url: '', mimeType: '' });
  });

  it('whenLoadingFails_trackLoadingFailed_shouldRemovePendingRequest', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    service.trackResponseReceived({
      requestId: 'r3',
      type: 'image',
      response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    // Action
    service.trackLoadingFailed({ requestId: 'r3' });
    // Assert
    const pendingSize = (service as unknown as { pendingImageRequests: Map<string, unknown> }).pendingImageRequests.size;
    expect(pendingSize).toBe(0);
  });

  it('whenLoadingFinishesWithPendingRequest_trackLoadingFinished_shouldFetchBodyAndDispatchPayload', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    service.trackResponseReceived({
      requestId: 'r4',
      type: 'image',
      response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    const network: NetworkDomain = {
      enable: jest.fn(async () => undefined),
      responseReceived: jest.fn(),
      loadingFinished: jest.fn(),
      loadingFailed: jest.fn(),
      getResponseBody: jest.fn(async () => ({ body: 'body-data', base64Encoded: true }))
    };
    const onImageBody = jest.fn(async () => undefined);
    const logger = new LoggerMock();
    // Action
    service.trackLoadingFinished(network, { requestId: 'r4' }, onImageBody, logger as unknown as Logger);
    await service.waitForPendingImageDownloads();
    // Assert
    expect(network.getResponseBody).toHaveBeenCalledWith({ requestId: 'r4' });
    expect(onImageBody as unknown as jest.Mock).toHaveBeenCalledWith({
      requestId: 'r4',
      url: 'https://img4.idealista.com/blur/a.jpg',
      mimeType: 'image/jpeg',
      body: { body: 'body-data', base64Encoded: true }
    });
  });

  it('whenLoadingFinishesWithoutPendingRequest_trackLoadingFinished_shouldIgnoreEvent', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    const network: NetworkDomain = {
      enable: jest.fn(async () => undefined),
      responseReceived: jest.fn(),
      loadingFinished: jest.fn(),
      loadingFailed: jest.fn(),
      getResponseBody: jest.fn(async () => ({ body: 'body-data', base64Encoded: true }))
    };
    const onImageBody = jest.fn(async () => undefined);
    const logger = new LoggerMock();
    // Action
    service.trackLoadingFinished(network, { requestId: 'r-missing' }, onImageBody, logger as unknown as Logger);
    // Assert
    expect(network.getResponseBody).not.toHaveBeenCalled();
    expect(onImageBody).not.toHaveBeenCalled();
  });

  it('whenBodyFetchFails_trackLoadingFinished_shouldLogWarningAndKeepFlowRunning', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    service.trackResponseReceived({
      requestId: 'r5',
      type: 'image',
      response: { url: 'https://img4.idealista.com/blur/b.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    const network: NetworkDomain = {
      enable: jest.fn(async () => undefined),
      responseReceived: jest.fn(),
      loadingFinished: jest.fn(),
      loadingFailed: jest.fn(),
      getResponseBody: jest.fn(async () => {
        throw new Error('cannot read body');
      })
    };
    const onImageBody = jest.fn(async () => undefined);
    const logger = new LoggerMock();
    // Action
    service.trackLoadingFinished(network, { requestId: 'r5' }, onImageBody, logger as unknown as Logger);
    await service.waitForPendingImageDownloads();
    // Assert
    expect(onImageBody).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('whenNetworkNeverSettles_waitForPendingImageDownloads_shouldWaitUntilTimeoutThenSettleActiveTasks', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    const activeTask = Promise.resolve();
    (service as unknown as { activeDownloadTasks: Set<Promise<void>> }).activeDownloadTasks.add(activeTask);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    await service.waitForPendingImageDownloads(1000);
    // Assert
    expect(sleep).toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('whenTimeoutHappensWithoutActiveTasks_waitForPendingImageDownloads_shouldSkipSettledWait', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    (service as unknown as { pendingImageRequests: Map<string, unknown> }).pendingImageRequests.set('req-1', {
      url: 'https://img4.idealista.com/a.jpg',
      mimeType: 'image/jpeg'
    });
    const allSettledSpy = jest.spyOn(Promise, 'allSettled');
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    await service.waitForPendingImageDownloads(1000);
    // Assert
    expect(allSettledSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
    allSettledSpy.mockRestore();
  });

  it('whenPendingRequestsAreReset_resetPendingRequests_shouldClearPendingMap', () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    service.trackResponseReceived({
      requestId: 'r6',
      type: 'image',
      response: { url: 'https://img4.idealista.com/blur/c.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    // Action
    service.resetPendingRequests();
    // Assert
    const pendingSize = (service as unknown as { pendingImageRequests: Map<string, unknown> }).pendingImageRequests.size;
    expect(pendingSize).toBe(0);
  });

  it('whenImageActivityWasSeenAndQueueIsIdle_waitForImageNetworkSettled_shouldReturnWithoutWarning', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    service.trackResponseReceived({
      requestId: 'r7',
      type: 'image',
      response: { url: 'https://img4.idealista.com/blur/d.jpg', mimeType: 'image/jpeg' }
    }, () => true);
    service.trackLoadingFailed({ requestId: 'r7' });
    const logger = new LoggerMock();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 800;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(logger as unknown as Logger, 3000, 1200);
    // Assert
    expect(logger.warn).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('whenSettleWaitUsesDefaults_waitForImageNetworkSettled_shouldUseDefaultTimeoutAndQuietWindow', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    (service as unknown as { imageNetworkActivitySeen: boolean }).imageNetworkActivitySeen = true;
    (service as unknown as { imageNetworkActivityCounter: number }).imageNetworkActivityCounter = 1;
    const pendingSpy = jest.spyOn(
      service as unknown as { waitForPendingImageDownloads: (timeoutMs?: number) => Promise<void> },
      'waitForPendingImageDownloads'
    ).mockImplementation(async () => {
      (service as unknown as { imageNetworkActivityCounter: number }).imageNetworkActivityCounter = 2;
      (service as unknown as { lastImageNetworkActivityAt: number }).lastImageNetworkActivityAt = 0;
    });
    const logger = new LoggerMock();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 1500;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(logger as unknown as Logger);
    // Assert
    expect(pendingSpy).toHaveBeenCalledWith(1200);
    nowSpy.mockRestore();
  });

  it('whenPendingWorkNeverDrains_waitForImageNetworkSettled_shouldSleepAndWarnAfterTimeout', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    (service as unknown as { pendingImageRequests: Map<string, unknown> }).pendingImageRequests.set('req', {
      url: 'https://img4.idealista.com/a.jpg',
      mimeType: 'image/jpeg'
    });
    jest.spyOn(
      service as unknown as { waitForPendingImageDownloads: (timeoutMs?: number) => Promise<void> },
      'waitForPendingImageDownloads'
    ).mockResolvedValue(undefined);
    const logger = new LoggerMock();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 900;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(logger as unknown as Logger, 1500, 1200);
    // Assert
    expect(sleep).toHaveBeenCalledWith(120);
    expect(logger.warn).toHaveBeenCalledWith('Image network did not become idle in 1500ms. Continuing with best-effort capture.');
    nowSpy.mockRestore();
  });

  it('whenNoActivityHasBeenSeen_waitForImageNetworkSettled_shouldPollGracefullyUntilTimeout', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    jest.spyOn(
      service as unknown as { waitForPendingImageDownloads: (timeoutMs?: number) => Promise<void> },
      'waitForPendingImageDownloads'
    ).mockResolvedValue(undefined);
    const logger = new LoggerMock();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 700;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(logger as unknown as Logger, 1200, 600);
    // Assert
    expect(sleep).toHaveBeenCalledWith(200);
    expect(logger.warn).toHaveBeenCalledWith('Image network did not become idle in 1200ms. Continuing with best-effort capture.');
    nowSpy.mockRestore();
  });

  it('whenCounterDidNotChangeWithinGrace_waitForImageNetworkSettled_shouldSleepOnGraceBranch', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    (service as unknown as { imageNetworkActivitySeen: boolean }).imageNetworkActivitySeen = true;
    (service as unknown as { imageNetworkActivityCounter: number }).imageNetworkActivityCounter = 3;
    jest.spyOn(
      service as unknown as { waitForPendingImageDownloads: (timeoutMs?: number) => Promise<void> },
      'waitForPendingImageDownloads'
    ).mockResolvedValue(undefined);
    const logger = new LoggerMock();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 400;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(logger as unknown as Logger, 3000, 1200);
    // Assert
    expect(sleep).toHaveBeenCalledWith(200);
    expect(logger.warn).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('whenNetworkIsActiveButNotQuiet_waitForImageNetworkSettled_shouldSleepUntilQuietWindowOrTimeout', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    (service as unknown as { imageNetworkActivitySeen: boolean }).imageNetworkActivitySeen = true;
    (service as unknown as { imageNetworkActivityCounter: number }).imageNetworkActivityCounter = 5;
    (service as unknown as { lastImageNetworkActivityAt: number }).lastImageNetworkActivityAt = 1000;
    const pendingSpy = jest.spyOn(
      service as unknown as { waitForPendingImageDownloads: (timeoutMs?: number) => Promise<void> },
      'waitForPendingImageDownloads'
    ).mockImplementation(async () => {
      (service as unknown as { imageNetworkActivityCounter: number }).imageNetworkActivityCounter = 6;
      (service as unknown as { lastImageNetworkActivityAt: number }).lastImageNetworkActivityAt = 5000;
    });
    const logger = new LoggerMock();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 700;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(logger as unknown as Logger, 1600, 1200);
    // Assert
    expect(pendingSpy).toHaveBeenCalled();
    expect(sleep).toHaveBeenCalledWith(120);
    expect(logger.warn).toHaveBeenCalledWith('Image network did not become idle in 1600ms. Continuing with best-effort capture.');
    nowSpy.mockRestore();
  });

  it('whenQuietWindowIsReached_waitForImageNetworkSettled_shouldReturnWithoutWarning', async () => {
    // Arrange
    const service = new ImageNetworkCaptureService();
    (service as unknown as { imageNetworkActivitySeen: boolean }).imageNetworkActivitySeen = true;
    (service as unknown as { imageNetworkActivityCounter: number }).imageNetworkActivityCounter = 10;
    const pendingSpy = jest.spyOn(
      service as unknown as { waitForPendingImageDownloads: (timeoutMs?: number) => Promise<void> },
      'waitForPendingImageDownloads'
    ).mockImplementation(async () => {
      (service as unknown as { imageNetworkActivityCounter: number }).imageNetworkActivityCounter = 11;
      (service as unknown as { lastImageNetworkActivityAt: number }).lastImageNetworkActivityAt = 0;
    });
    const logger = new LoggerMock();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 1000;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(logger as unknown as Logger, 5000, 1200);
    // Assert
    expect(pendingSpy).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });
});
