import { Inject, Injectable, Logger } from '@nestjs/common';
import { NetworkLoadingFailedEvent } from 'application/dto/imagedownload/network-loading-failed-event.dto';
import { NetworkLoadingFinishedEvent } from 'application/dto/imagedownload/network-loading-finished-event.dto';
import { NetworkResponseReceivedEvent } from 'application/dto/imagedownload/network-response-received-event.dto';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';
import { CLOCK_PORT } from 'ports/outbound/timing/clock.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { ImageResponseBodyPayload } from 'application/dto/imagedownload/image-response-body-payload.dto';
import type { NetworkDomain } from 'ports/outbound/browser/network-domain.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { ClockPort } from 'ports/outbound/timing/clock.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';
@Injectable()
export class ImageNetworkCaptureService {
  private readonly pendingImageRequests = new Map<string, { url: string; mimeType: string }>();
  private readonly initializedClients = new WeakSet<object>();
  private readonly activeDownloadTasks = new Set<Promise<void>>();
  private lastImageNetworkActivityAt = 0;
  private imageNetworkActivitySeen = false;
  private imageNetworkActivityCounter = 0;

  constructor(
    @Inject(SLEEP_PORT)
    private readonly sleepPort: SleepPort,
    @Inject(CLOCK_PORT) private readonly clockPort: ClockPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  isInitialized(client: object): boolean {
    return this.initializedClients.has(client);
  }

  markInitialized(client: object): void {
    this.initializedClients.add(client);
  }

  trackResponseReceived(event: NetworkResponseReceivedEvent, isAllowedDomain: (url: string) => boolean): void {
    const responseType = (event.type ?? '').toLowerCase();
    const url = event.response.url ?? '';
    const mimeType = event.response.mimeType ?? '';

    if (responseType !== 'image') {
      return;
    }
    if (!isAllowedDomain(url)) {
      return;
    }

    this.markImageNetworkActivity();
    this.pendingImageRequests.set(event.requestId, { url, mimeType });
  }

  trackLoadingFailed(event: NetworkLoadingFailedEvent): void {
    this.markImageNetworkActivity();
    this.pendingImageRequests.delete(event.requestId);
  }

  trackLoadingFinished(
    network: NetworkDomain,
    event: NetworkLoadingFinishedEvent,
    onImageBody: (payload: ImageResponseBodyPayload) => Promise<void>,
    logger: Logger
  ): void {
    const pending = this.pendingImageRequests.get(event.requestId);
    if (!pending) {
      return;
    }

    this.markImageNetworkActivity();
    this.pendingImageRequests.delete(event.requestId);
    const task = this.fetchAndDispatchImageBody(network, event.requestId, pending.url, pending.mimeType, onImageBody, logger)
      .finally(() => this.activeDownloadTasks.delete(task));
    this.activeDownloadTasks.add(task);
  }

  async waitForPendingImageDownloads(timeoutMs = 15000): Promise<void> {
    const start = this.clockPort.nowMs();
    while (this.clockPort.nowMs() - start < timeoutMs) {
      if (this.pendingImageRequests.size === 0 && this.activeDownloadTasks.size === 0) {
        return;
      }
      await this.sleepPort.sleep(100);
    }

    if (this.activeDownloadTasks.size > 0) {
      await Promise.allSettled([...this.activeDownloadTasks]);
    }
  }

  async waitForImageNetworkSettled(logger: Logger, maxWaitMs = 12000, quietWindowMs = 1200): Promise<void> {
    const start = this.clockPort.nowMs();
    const startCounter = this.imageNetworkActivityCounter;
    const noActivityGraceMs = Math.min(2500, maxWaitMs);

    while (this.clockPort.nowMs() - start < maxWaitMs) {
      await this.waitForPendingImageDownloads(Math.min(quietWindowMs, 1200));
      const noPendingWork = this.pendingImageRequests.size === 0 && this.activeDownloadTasks.size === 0;
      if (!noPendingWork) {
        await this.sleepPort.sleep(120);
        continue;
      }

      if (!this.imageNetworkActivitySeen) {
        await this.sleepPort.sleep(200);
        continue;
      }

      if (this.imageNetworkActivityCounter === startCounter) {
        if (this.clockPort.nowMs() - start >= noActivityGraceMs) {
          return;
        }
        await this.sleepPort.sleep(200);
        continue;
      }

      const idleMs = this.clockPort.nowMs() - this.lastImageNetworkActivityAt;
      if (idleMs >= quietWindowMs) {
        return;
      }

      await this.sleepPort.sleep(120);
    }

    logger.warn(`Image network did not become idle in ${maxWaitMs}ms. Continuing with best-effort capture.`);
  }

  resetPendingRequests(): void {
    this.pendingImageRequests.clear();
  }

  private async fetchAndDispatchImageBody(
    network: NetworkDomain,
    requestId: string,
    url: string,
    mimeType: string,
    onImageBody: (payload: ImageResponseBodyPayload) => Promise<void>,
    logger: Logger
  ): Promise<void> {
    try {
      const body = await network.getResponseBody({ requestId });
      await onImageBody({ requestId, url, mimeType, body });
      this.markImageNetworkActivity();
    } catch (error) {
      const message = this.errorMessagePort.toErrorMessage(error);
      logger.warn(`Failed to capture image response body for "${url}" (requestId=${requestId}): ${message}`);
    }
  }

  private markImageNetworkActivity(): void {
    this.imageNetworkActivitySeen = true;
    this.lastImageNetworkActivityAt = this.clockPort.nowMs();
    this.imageNetworkActivityCounter += 1;
  }

}
