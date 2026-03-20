import { Injectable } from '@nestjs/common';
import { ChromiumCdpReadinessService } from 'application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumGeolocationService } from 'application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'application/services/chromium/chromium-network-headers.service';
import { ChromiumProcessLifecycleService } from 'application/services/chromium/chromium-process-lifecycle.service';

@Injectable()
export class BootstrapChromiumSessionUseCase {
  constructor(
    private readonly chromiumProcessLifecycleService: ChromiumProcessLifecycleService,
    private readonly chromiumCdpReadinessService: ChromiumCdpReadinessService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService
  ) {}

  async execute(params: {
    cdpHost: string;
    cdpPort: number;
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void;
    isShuttingDown: () => boolean;
  }): Promise<void> {
    await this.chromiumProcessLifecycleService.launchChromiumProcess(
      params.cdpPort,
      params.onUnexpectedExit,
      params.isShuttingDown
    );
    await this.chromiumCdpReadinessService.waitForReadyEndpoint(params.cdpHost, params.cdpPort);
    await this.chromiumGeolocationService.grantStartupPermissions(params.cdpHost, params.cdpPort);
    this.chromiumGeolocationService.startTargetLoop(params.cdpHost, params.cdpPort, params.isShuttingDown);
    this.chromiumNetworkHeadersService.startTargetLoop(params.cdpHost, params.cdpPort, params.isShuttingDown);
  }
}
