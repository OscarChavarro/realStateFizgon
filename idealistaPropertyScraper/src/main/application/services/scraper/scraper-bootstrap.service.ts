import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChromiumCdpReadinessService } from 'src/application/services/chromium/chromium-cdp-readiness.service';
import { ChromiumProcessLifecycleService } from 'src/application/services/chromium/chromium-process-lifecycle.service';
import { ChromiumFailureGuardService } from 'src/application/services/chromium/chromium-failure-guard.service';
import { ChromiumGeolocationService } from 'src/application/services/chromium/chromium-geolocation.service';
import { ChromiumNetworkHeadersService } from 'src/application/services/chromium/chromium-network-headers.service';
import { InfrastructurePreCheckService } from 'src/application/services/prechecks/infrastructure-pre-check.service';
import { HomeSearchPreparationFlowService } from 'src/application/services/bootstrap/home-search-preparation-flow.service';
import { ScraperOrchestratorService } from 'src/application/services/scraper/scraper-orchestrator.service';
import { toErrorMessage } from 'src/infrastructure/error-message';

@Injectable()
export class ScraperBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly browserFailureRecoveryWaitMs = 10 * 1000;
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;
  private shuttingDown = false;

  constructor(
    private readonly chromiumCdpReadinessService: ChromiumCdpReadinessService,
    private readonly chromiumProcessLifecycleService: ChromiumProcessLifecycleService,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly chromiumGeolocationService: ChromiumGeolocationService,
    private readonly chromiumNetworkHeadersService: ChromiumNetworkHeadersService,
    private readonly infrastructurePreCheckService: InfrastructurePreCheckService,
    private readonly homeSearchPreparationFlowService: HomeSearchPreparationFlowService,
    private readonly scraperOrchestratorService: ScraperOrchestratorService
  ) {}

  async onModuleInit(): Promise<void> {
    const onUnexpectedExit = this.createUnexpectedChromeExitHandler();
    try {
      await this.infrastructurePreCheckService.runBeforeScraperStartup();
      await this.launchChrome(onUnexpectedExit);
      await this.homeSearchPreparationFlowService.execute(this.cdpHost, this.cdpPort);
      this.scraperOrchestratorService.start({
        cdpHost: this.cdpHost,
        cdpPort: this.cdpPort,
        isShuttingDown: () => this.shuttingDown,
        onUnexpectedChromeExit: onUnexpectedExit,
        browserFailureRecoveryWaitMs: this.browserFailureRecoveryWaitMs
      });
    } catch (error) {
      await this.chromiumFailureGuardService.recoverFromFailure({
        reason: `Browser startup flow failed. ${toErrorMessage(error)}`,
        cdpHost: this.cdpHost,
        cdpPort: this.cdpPort,
        browserFailureRecoveryWaitMs: this.browserFailureRecoveryWaitMs,
        isShuttingDown: () => this.shuttingDown,
        onUnexpectedExit
      });
      if (this.shuttingDown) {
        return;
      }

      this.scraperOrchestratorService.start({
        cdpHost: this.cdpHost,
        cdpPort: this.cdpPort,
        isShuttingDown: () => this.shuttingDown,
        onUnexpectedChromeExit: onUnexpectedExit,
        browserFailureRecoveryWaitMs: this.browserFailureRecoveryWaitMs
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    this.chromiumProcessLifecycleService.stopChromiumProcess();
  }

  private async launchChrome(
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void
  ): Promise<void> {
    await this.chromiumProcessLifecycleService.launchChromiumProcess(
      this.cdpPort,
      onUnexpectedExit,
      () => this.shuttingDown
    );
    await this.chromiumCdpReadinessService.waitForReadyEndpoint(this.cdpHost, this.cdpPort);
    await this.chromiumGeolocationService.grantStartupPermissions(this.cdpHost, this.cdpPort);
    this.chromiumGeolocationService.startTargetLoop(this.cdpHost, this.cdpPort, () => this.shuttingDown);
    this.chromiumNetworkHeadersService.startTargetLoop(this.cdpHost, this.cdpPort, () => this.shuttingDown);
  }

  private createUnexpectedChromeExitHandler(): (code: number | null, signal: NodeJS.Signals | null) => void {
    return (code, signal) => {
      void this.chromiumFailureGuardService.handleUnexpectedChromeExit({
        code,
        signal,
        cdpHost: this.cdpHost,
        cdpPort: this.cdpPort,
        browserFailureRecoveryWaitMs: this.browserFailureRecoveryWaitMs,
        isShuttingDown: () => this.shuttingDown,
        onUnexpectedExit: this.createUnexpectedChromeExitHandler()
      });
    };
  }

}
