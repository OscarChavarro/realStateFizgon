import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChromiumProcessLifecycleService } from 'application/services/chromium/chromium-process-lifecycle.service';
import { ChromiumFailureGuardService } from 'application/services/chromium/chromium-failure-guard.service';
import { InitializeScraperBootstrapUseCase } from 'application/usecases/bootstrap/initialize-scraper-bootstrap.use-case';

@Injectable()
export class ScraperBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly browserFailureRecoveryWaitMs = 10 * 1000;
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;
  private shuttingDown = false;

  constructor(
    private readonly chromiumProcessLifecycleService: ChromiumProcessLifecycleService,
    private readonly chromiumFailureGuardService: ChromiumFailureGuardService,
    private readonly initializeScraperBootstrapUseCase: InitializeScraperBootstrapUseCase
  ) {}

  async onModuleInit(): Promise<void> {
    const onUnexpectedExit = this.createUnexpectedChromeExitHandler();
    await this.initializeScraperBootstrapUseCase.execute({
      cdpHost: this.cdpHost,
      cdpPort: this.cdpPort,
      browserFailureRecoveryWaitMs: this.browserFailureRecoveryWaitMs,
      isShuttingDown: () => this.shuttingDown,
      onUnexpectedExit
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    this.chromiumProcessLifecycleService.stopChromiumProcess();
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
