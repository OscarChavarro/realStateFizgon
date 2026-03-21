import { Inject, Injectable, Logger } from '@nestjs/common';
import { NetworkLoadingFailedEvent } from 'application/dto/imagedownload/network-loading-failed-event.dto';
import { NetworkLoadingFinishedEvent } from 'application/dto/imagedownload/network-loading-finished-event.dto';
import { NetworkResponseReceivedEvent } from 'application/dto/imagedownload/network-response-received-event.dto';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';
import { CLOCK_PORT } from 'ports/outbound/timing/clock.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { ScrapeRunContext, ScrapeRunImageNetworkState } from 'application/context/scrape-run-context';
import type { ImageResponseBodyPayload } from 'application/dto/imagedownload/image-response-body-payload.dto';
import type { NetworkDomain } from 'ports/outbound/browser/network-domain.port';
import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { ClockPort } from 'ports/outbound/timing/clock.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';
@Injectable()
export class ImageNetworkCaptureService {
  constructor(
    @Inject(SLEEP_PORT)
    private readonly sleepPort: SleepPort,
    @Inject(CLOCK_PORT) private readonly clockPort: ClockPort,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort
  ) {}

  isInitialized(client: object, scrapeRunContext: ScrapeRunContext): boolean {
    return this.getNetworkState(scrapeRunContext).initializedClients.has(client);
  }

  markInitialized(client: object, scrapeRunContext: ScrapeRunContext): void {
    this.getNetworkState(scrapeRunContext).initializedClients.add(client);
  }

  trackResponseReceived(
    scrapeRunContext: ScrapeRunContext,
    event: NetworkResponseReceivedEvent,
    isAllowedDomain: (url: string) => boolean
  ): void {
    const networkState = this.getNetworkState(scrapeRunContext);
    const responseType = (event.type ?? '').toLowerCase();
    const url = event.response.url ?? '';
    const mimeType = event.response.mimeType ?? '';

    if (responseType !== 'image') {
      return;
    }
    if (!isAllowedDomain(url)) {
      return;
    }

    this.markImageNetworkActivity(networkState);
    networkState.pendingImageRequests.set(event.requestId, { url, mimeType });
  }

  trackLoadingFailed(scrapeRunContext: ScrapeRunContext, event: NetworkLoadingFailedEvent): void {
    const networkState = this.getNetworkState(scrapeRunContext);
    this.markImageNetworkActivity(networkState);
    networkState.pendingImageRequests.delete(event.requestId);
  }

  trackLoadingFinished(
    scrapeRunContext: ScrapeRunContext,
    network: NetworkDomain,
    event: NetworkLoadingFinishedEvent,
    onImageBody: (payload: ImageResponseBodyPayload) => Promise<void>,
    logger: Logger
  ): void {
    const networkState = this.getNetworkState(scrapeRunContext);
    const pending = networkState.pendingImageRequests.get(event.requestId);
    if (!pending) {
      return;
    }

    this.markImageNetworkActivity(networkState);
    networkState.pendingImageRequests.delete(event.requestId);
    const task = this.fetchAndDispatchImageBody(
      scrapeRunContext,
      network,
      event.requestId,
      pending.url,
      pending.mimeType,
      onImageBody,
      logger
    ).finally(() => networkState.activeDownloadTasks.delete(task));
    networkState.activeDownloadTasks.add(task);
  }

  async waitForPendingImageDownloads(scrapeRunContext: ScrapeRunContext, timeoutMs = 15000): Promise<void> {
    const networkState = this.getNetworkState(scrapeRunContext);
    const start = this.clockPort.nowMs();
    while (this.clockPort.nowMs() - start < timeoutMs) {
      if (networkState.pendingImageRequests.size === 0 && networkState.activeDownloadTasks.size === 0) {
        return;
      }
      await this.sleepPort.sleep(100);
    }

    if (networkState.activeDownloadTasks.size > 0) {
      await Promise.allSettled([...networkState.activeDownloadTasks]);
    }
  }

  async waitForImageNetworkSettled(
    scrapeRunContext: ScrapeRunContext,
    logger: Logger,
    maxWaitMs = 12000,
    quietWindowMs = 1200
  ): Promise<void> {
    const networkState = this.getNetworkState(scrapeRunContext);
    const start = this.clockPort.nowMs();
    const startCounter = networkState.imageNetworkActivityCounter;
    const noActivityGraceMs = Math.min(2500, maxWaitMs);

    while (this.clockPort.nowMs() - start < maxWaitMs) {
      await this.waitForPendingImageDownloads(scrapeRunContext, Math.min(quietWindowMs, 1200));
      const noPendingWork = networkState.pendingImageRequests.size === 0 && networkState.activeDownloadTasks.size === 0;
      if (!noPendingWork) {
        await this.sleepPort.sleep(120);
        continue;
      }

      if (!networkState.imageNetworkActivitySeen) {
        await this.sleepPort.sleep(200);
        continue;
      }

      if (networkState.imageNetworkActivityCounter === startCounter) {
        if (this.clockPort.nowMs() - start >= noActivityGraceMs) {
          return;
        }
        await this.sleepPort.sleep(200);
        continue;
      }

      const idleMs = this.clockPort.nowMs() - networkState.lastImageNetworkActivityAt;
      if (idleMs >= quietWindowMs) {
        return;
      }

      await this.sleepPort.sleep(120);
    }

    logger.warn(`Image network did not become idle in ${maxWaitMs}ms. Continuing with best-effort capture.`);
  }

  resetPendingRequests(scrapeRunContext: ScrapeRunContext): void {
    this.getNetworkState(scrapeRunContext).pendingImageRequests.clear();
  }

  private async fetchAndDispatchImageBody(
    scrapeRunContext: ScrapeRunContext,
    network: NetworkDomain,
    requestId: string,
    url: string,
    mimeType: string,
    onImageBody: (payload: ImageResponseBodyPayload) => Promise<void>,
    logger: Logger
  ): Promise<void> {
    const networkState = this.getNetworkState(scrapeRunContext);
    try {
      const body = await network.getResponseBody({ requestId });
      await onImageBody({ requestId, url, mimeType, body });
      this.markImageNetworkActivity(networkState);
    } catch (error) {
      const message = this.errorMessagePort.toErrorMessage(error);
      logger.warn(`Failed to capture image response body for "${url}" (requestId=${requestId}): ${message}`);
    }
  }

  private markImageNetworkActivity(networkState: ScrapeRunImageNetworkState): void {
    networkState.imageNetworkActivitySeen = true;
    networkState.lastImageNetworkActivityAt = this.clockPort.nowMs();
    networkState.imageNetworkActivityCounter += 1;
  }

  private getNetworkState(scrapeRunContext: ScrapeRunContext): ScrapeRunImageNetworkState {
    return scrapeRunContext.image.networkCapture;
  }
}
