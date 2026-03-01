import { Injectable, Logger } from '@nestjs/common';
import { ImageResponseBodyPayload } from './image-response-body-payload.type';
import { NetworkDomain } from './network-domain.type';
import { NetworkLoadingFailedEvent } from './network-loading-failed-event.type';
import { NetworkLoadingFinishedEvent } from './network-loading-finished-event.type';
import { NetworkResponseReceivedEvent } from './network-response-received-event.type';

@Injectable()
export class ImageNetworkCaptureService {
  private readonly pendingImageRequests = new Map<string, { url: string; mimeType: string }>();
  private readonly initializedClients = new WeakSet<object>();
  private readonly activeDownloadTasks = new Set<Promise<void>>();
  private lastImageNetworkActivityAt = 0;
  private imageNetworkActivitySeen = false;
  private imageNetworkActivityCounter = 0;

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
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.pendingImageRequests.size === 0 && this.activeDownloadTasks.size === 0) {
        return;
      }
      await this.sleep(100);
    }

    if (this.activeDownloadTasks.size > 0) {
      await Promise.allSettled([...this.activeDownloadTasks]);
    }
  }

  async waitForImageNetworkSettled(logger: Logger, maxWaitMs = 12000, quietWindowMs = 1200): Promise<void> {
    const start = Date.now();
    const startCounter = this.imageNetworkActivityCounter;
    const noActivityGraceMs = Math.min(2500, maxWaitMs);

    while (Date.now() - start < maxWaitMs) {
      await this.waitForPendingImageDownloads(Math.min(quietWindowMs, 1200));
      const noPendingWork = this.pendingImageRequests.size === 0 && this.activeDownloadTasks.size === 0;
      if (!noPendingWork) {
        await this.sleep(120);
        continue;
      }

      if (!this.imageNetworkActivitySeen) {
        await this.sleep(200);
        continue;
      }

      if (this.imageNetworkActivityCounter === startCounter) {
        if (Date.now() - start >= noActivityGraceMs) {
          return;
        }
        await this.sleep(200);
        continue;
      }

      const idleMs = Date.now() - this.lastImageNetworkActivityAt;
      if (idleMs >= quietWindowMs) {
        return;
      }

      await this.sleep(120);
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
      // TODO: Should add metric. If not scraping property details should skip.
    }
  }

  private markImageNetworkActivity(): void {
    this.imageNetworkActivitySeen = true;
    this.lastImageNetworkActivityAt = Date.now();
    this.imageNetworkActivityCounter += 1;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
