import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { createScrapeRunContext } from 'application/context/scrape-run-context';
import { ImageNetworkCaptureService } from 'application/services/imagedownload/image-network-capture.service';
import type { NetworkDomain } from 'ports/outbound/browser/network-domain.port';

class LoggerMock {
  readonly warn = jest.fn<(message: string) => void>();
}

type SleepPortMock = {
  sleep: jest.Mock<(ms: number) => Promise<void>>;
};

type ErrorMessagePortMock = {
  toErrorMessage: jest.Mock<(error: unknown) => string>;
};

function createService() {
  const sleepPort: SleepPortMock = {
    sleep: jest.fn(async () => undefined)
  };
  const clockPort = {
    nowMs: jest.fn<() => number>().mockReturnValue(0)
  };
  const errorMessagePort: ErrorMessagePortMock = {
    toErrorMessage: jest.fn((error: unknown) => (error instanceof Error ? error.message : String(error)))
  };
  const service = new ImageNetworkCaptureService(
    sleepPort as never,
    clockPort as never,
    errorMessagePort as never
  );

  return { service, sleepPort, clockPort, errorMessagePort };
}

describe('ImageNetworkCaptureService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenClientIsMarkedInitialized_isInitialized_shouldReturnTrue', () => {
    // Arrange
    const { service } = createService();
    const client = {};
    const scrapeRunContext = createScrapeRunContext();
    service.markInitialized(client, scrapeRunContext);
    // Action
    const initialized = service.isInitialized(client, scrapeRunContext);
    // Assert
    expect(initialized).toBe(true);
  });

  it('whenResponseIsNotTrackable_trackResponseReceived_shouldIgnoreRequest', () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    // Action
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r1',
        type: 'document',
        response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
    // Assert
    expect(scrapeRunContext.image.networkCapture.pendingImageRequests.size).toBe(0);
  });

  it('whenResponseTypeIsMissing_trackResponseReceived_shouldFallbackToEmptyTypeAndIgnoreRequest', () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    // Action
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r-missing-type',
        type: undefined,
        response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
    // Assert
    expect(scrapeRunContext.image.networkCapture.pendingImageRequests.size).toBe(0);
  });

  it('whenResponseDomainIsNotAllowed_trackResponseReceived_shouldIgnoreRequest', () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    // Action
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r1-denied',
        type: 'image',
        response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
      },
      () => false
    );
    // Assert
    expect(scrapeRunContext.image.networkCapture.pendingImageRequests.size).toBe(0);
  });

  it('whenResponseIsImageFromAllowedDomain_trackResponseReceived_shouldStorePendingRequest', () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    // Action
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r2',
        type: 'image',
        response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
    // Assert
    const pending = scrapeRunContext.image.networkCapture.pendingImageRequests.get('r2');
    expect(pending?.url).toBe('https://img4.idealista.com/blur/a.jpg');
  });

  it('whenResponseUrlAndMimeTypeAreMissing_trackResponseReceived_shouldFallbackToEmptyStrings', () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    // Action
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r-empty',
        type: 'image',
        response: { url: undefined as unknown as string, mimeType: undefined }
      },
      () => true
    );
    // Assert
    const pending = scrapeRunContext.image.networkCapture.pendingImageRequests.get('r-empty');
    expect(pending).toEqual({ url: '', mimeType: '' });
  });

  it('whenLoadingFails_trackLoadingFailed_shouldRemovePendingRequest', () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r3',
        type: 'image',
        response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
    // Action
    service.trackLoadingFailed(scrapeRunContext, { requestId: 'r3' });
    // Assert
    expect(scrapeRunContext.image.networkCapture.pendingImageRequests.size).toBe(0);
  });

  it('whenLoadingFinishesWithPendingRequest_trackLoadingFinished_shouldFetchBodyAndDispatchPayload', async () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r4',
        type: 'image',
        response: { url: 'https://img4.idealista.com/blur/a.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
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
    service.trackLoadingFinished(
      scrapeRunContext,
      network,
      { requestId: 'r4' },
      onImageBody,
      logger as unknown as Logger
    );
    await service.waitForPendingImageDownloads(scrapeRunContext);
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
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
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
    service.trackLoadingFinished(
      scrapeRunContext,
      network,
      { requestId: 'r-missing' },
      onImageBody,
      logger as unknown as Logger
    );
    // Assert
    expect(network.getResponseBody).not.toHaveBeenCalled();
    expect(onImageBody).not.toHaveBeenCalled();
  });

  it('whenBodyFetchFails_trackLoadingFinished_shouldLogWarningAndKeepFlowRunning', async () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r5',
        type: 'image',
        response: { url: 'https://img4.idealista.com/blur/b.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
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
    service.trackLoadingFinished(
      scrapeRunContext,
      network,
      { requestId: 'r5' },
      onImageBody,
      logger as unknown as Logger
    );
    await service.waitForPendingImageDownloads(scrapeRunContext);
    // Assert
    expect(onImageBody).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('whenNetworkNeverSettles_waitForPendingImageDownloads_shouldWaitUntilTimeoutThenSettleActiveTasks', async () => {
    // Arrange
    const { service, sleepPort, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    const activeTask = Promise.resolve();
    scrapeRunContext.image.networkCapture.activeDownloadTasks.add(activeTask);
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    await service.waitForPendingImageDownloads(scrapeRunContext, 1000);
    // Assert
    expect(sleepPort.sleep).toHaveBeenCalled();
  });

  it('whenTimeoutHappensWithoutActiveTasks_waitForPendingImageDownloads_shouldSkipSettledWait', async () => {
    // Arrange
    const { service, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.image.networkCapture.pendingImageRequests.set('req-1', {
      url: 'https://img4.idealista.com/a.jpg',
      mimeType: 'image/jpeg'
    });
    const allSettledSpy = jest.spyOn(Promise, 'allSettled');
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 600;
      return now;
    });
    // Action
    await service.waitForPendingImageDownloads(scrapeRunContext, 1000);
    // Assert
    expect(allSettledSpy).not.toHaveBeenCalled();
    allSettledSpy.mockRestore();
  });

  it('whenPendingRequestsAreReset_resetPendingRequests_shouldClearPendingMap', () => {
    // Arrange
    const { service } = createService();
    const scrapeRunContext = createScrapeRunContext();
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r6',
        type: 'image',
        response: { url: 'https://img4.idealista.com/blur/c.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
    // Action
    service.resetPendingRequests(scrapeRunContext);
    // Assert
    expect(scrapeRunContext.image.networkCapture.pendingImageRequests.size).toBe(0);
  });

  it('whenImageActivityWasSeenAndQueueIsIdle_waitForImageNetworkSettled_shouldReturnWithoutWarning', async () => {
    // Arrange
    const { service, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    service.trackResponseReceived(
      scrapeRunContext,
      {
        requestId: 'r7',
        type: 'image',
        response: { url: 'https://img4.idealista.com/blur/d.jpg', mimeType: 'image/jpeg' }
      },
      () => true
    );
    service.trackLoadingFailed(scrapeRunContext, { requestId: 'r7' });
    const logger = new LoggerMock();
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 800;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(scrapeRunContext, logger as unknown as Logger, 3000, 1200);
    // Assert
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenSettleWaitUsesDefaults_waitForImageNetworkSettled_shouldUseDefaultTimeoutAndQuietWindow', async () => {
    // Arrange
    const { service, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.image.networkCapture.imageNetworkActivitySeen = true;
    scrapeRunContext.image.networkCapture.imageNetworkActivityCounter = 1;
    const pendingSpy = jest
      .spyOn(service, 'waitForPendingImageDownloads')
      .mockImplementation(async () => {
        scrapeRunContext.image.networkCapture.imageNetworkActivityCounter = 2;
        scrapeRunContext.image.networkCapture.lastImageNetworkActivityAt = 0;
      });
    const logger = new LoggerMock();
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 1500;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(scrapeRunContext, logger as unknown as Logger);
    // Assert
    expect(pendingSpy).toHaveBeenCalledWith(scrapeRunContext, 1200);
  });

  it('whenPendingWorkNeverDrains_waitForImageNetworkSettled_shouldSleepAndWarnAfterTimeout', async () => {
    // Arrange
    const { service, sleepPort, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.image.networkCapture.pendingImageRequests.set('req', {
      url: 'https://img4.idealista.com/a.jpg',
      mimeType: 'image/jpeg'
    });
    jest.spyOn(service, 'waitForPendingImageDownloads').mockResolvedValue(undefined);
    const logger = new LoggerMock();
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 900;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(scrapeRunContext, logger as unknown as Logger, 1500, 1200);
    // Assert
    expect(sleepPort.sleep).toHaveBeenCalledWith(120);
    expect(logger.warn).toHaveBeenCalledWith('Image network did not become idle in 1500ms. Continuing with best-effort capture.');
  });

  it('whenNoActivityHasBeenSeen_waitForImageNetworkSettled_shouldPollGracefullyUntilTimeout', async () => {
    // Arrange
    const { service, sleepPort, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    jest.spyOn(service, 'waitForPendingImageDownloads').mockResolvedValue(undefined);
    const logger = new LoggerMock();
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 700;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(scrapeRunContext, logger as unknown as Logger, 1200, 600);
    // Assert
    expect(sleepPort.sleep).toHaveBeenCalledWith(200);
    expect(logger.warn).toHaveBeenCalledWith('Image network did not become idle in 1200ms. Continuing with best-effort capture.');
  });

  it('whenCounterDidNotChangeWithinGrace_waitForImageNetworkSettled_shouldSleepOnGraceBranch', async () => {
    // Arrange
    const { service, sleepPort, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.image.networkCapture.imageNetworkActivitySeen = true;
    scrapeRunContext.image.networkCapture.imageNetworkActivityCounter = 3;
    jest.spyOn(service, 'waitForPendingImageDownloads').mockResolvedValue(undefined);
    const logger = new LoggerMock();
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 400;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(scrapeRunContext, logger as unknown as Logger, 3000, 1200);
    // Assert
    expect(sleepPort.sleep).toHaveBeenCalledWith(200);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('whenNetworkIsActiveButNotQuiet_waitForImageNetworkSettled_shouldSleepUntilQuietWindowOrTimeout', async () => {
    // Arrange
    const { service, sleepPort, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.image.networkCapture.imageNetworkActivitySeen = true;
    scrapeRunContext.image.networkCapture.imageNetworkActivityCounter = 5;
    scrapeRunContext.image.networkCapture.lastImageNetworkActivityAt = 1000;
    const pendingSpy = jest
      .spyOn(service, 'waitForPendingImageDownloads')
      .mockImplementation(async () => {
        scrapeRunContext.image.networkCapture.imageNetworkActivityCounter = 6;
        scrapeRunContext.image.networkCapture.lastImageNetworkActivityAt = 5000;
      });
    const logger = new LoggerMock();
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 700;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(scrapeRunContext, logger as unknown as Logger, 1600, 1200);
    // Assert
    expect(pendingSpy).toHaveBeenCalled();
    expect(sleepPort.sleep).toHaveBeenCalledWith(120);
    expect(logger.warn).toHaveBeenCalledWith('Image network did not become idle in 1600ms. Continuing with best-effort capture.');
  });

  it('whenQuietWindowIsReached_waitForImageNetworkSettled_shouldReturnWithoutWarning', async () => {
    // Arrange
    const { service, clockPort } = createService();
    const scrapeRunContext = createScrapeRunContext();
    scrapeRunContext.image.networkCapture.imageNetworkActivitySeen = true;
    scrapeRunContext.image.networkCapture.imageNetworkActivityCounter = 10;
    const pendingSpy = jest
      .spyOn(service, 'waitForPendingImageDownloads')
      .mockImplementation(async () => {
        scrapeRunContext.image.networkCapture.imageNetworkActivityCounter = 11;
        scrapeRunContext.image.networkCapture.lastImageNetworkActivityAt = 0;
      });
    const logger = new LoggerMock();
    let now = 0;
    clockPort.nowMs.mockImplementation(() => {
      now += 1000;
      return now;
    });
    // Action
    await service.waitForImageNetworkSettled(scrapeRunContext, logger as unknown as Logger, 5000, 1200);
    // Assert
    expect(pendingSpy).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
