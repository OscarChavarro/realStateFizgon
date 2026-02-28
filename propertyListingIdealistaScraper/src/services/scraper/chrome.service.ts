import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { accessSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import CDP = require('chrome-remote-interface');
import { ProxyService } from '@real-state-fizgon/proxy';
import { Configuration } from '../../config/configuration';
import { FiltersService } from './filters/filters.service';
import { MainPageService } from './main-page.service';
import { PropertyListingPaginationService } from './pagination/property-listing-pagination.service';

@Injectable()
export class ChromeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChromeService.name);
  private readonly browserFailureHoldMs = 60 * 60 * 1000;
  private readonly proxyService = new ProxyService();
  private chromeProcess?: ChildProcess;
  private chromeStdoutFd?: number;
  private chromeStderrFd?: number;
  private readonly cdpHost = '127.0.0.1';
  private readonly cdpPort = 9222;
  private shuttingDown = false;
  private debugHoldInProgress = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly mainPageService: MainPageService,
    private readonly filtersService: FiltersService,
    private readonly propertyListingPaginationService: PropertyListingPaginationService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.proxyService.validateProxyAccessOrWait({
        enabled: this.configuration.proxyEnabled,
        host: this.configuration.proxyHost,
        port: this.configuration.proxyPort,
        retryWaitMs: this.configuration.chromeBrowserLaunchRetryWaitMs,
        logger: this.logger
      });
      await this.launchChrome();
      await this.openHomePage();
    } catch (error) {
      await this.holdForDebug(
        `Browser startup flow failed. ${this.errorToMessage(error)}`
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.chromeProcess && !this.chromeProcess.killed) {
      this.chromeProcess.kill('SIGTERM');
    }
  }

  private async launchChrome(): Promise<void> {
    const logsDir = join(process.cwd(), 'output', 'logs');
    mkdirSync(logsDir, { recursive: true });
    const browserBinary = this.resolveBrowserBinary();

    while (!this.shuttingDown) {
      this.chromeStdoutFd = openSync(join(logsDir, 'chrome_stdout.log'), 'a');
      this.chromeStderrFd = openSync(join(logsDir, 'chrome_stderr.log'), 'a');

      try {
        this.chromeProcess = spawn(browserBinary, [
          `--remote-debugging-port=${this.cdpPort}`,
          `--user-data-dir=${this.configuration.chromePath}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--new-window',
          ...this.configuration.chromiumOptions,
          this.configuration.scraperHomeUrl
        ], {
          stdio: ['ignore', this.chromeStdoutFd, this.chromeStderrFd]
        });

        await new Promise<void>((resolve, reject) => {
          this.chromeProcess?.once('spawn', () => resolve());
          this.chromeProcess?.once('error', (error) => reject(error));
        });
      } catch (error) {
        this.closeChromeLogFds();
        if (this.isBrowserBinaryMissingError(error)) {
          const waitMs = this.configuration.chromeBrowserLaunchRetryWaitMs;
          this.logger.error(
            `Browser binary "${browserBinary}" was not found. Waiting ${Math.floor(waitMs / 1000)} seconds before retrying launch.`
          );
          await this.sleep(waitMs);
          continue;
        }

        throw error;
      }

      this.logger.log(`Chrome process started with PID ${this.chromeProcess.pid ?? 'unknown'}.`);
      this.chromeProcess.once('exit', (code, signal) => {
        this.closeChromeLogFds();
        void this.handleUnexpectedChromeExit(code, signal);
      });

      await this.waitForCdp();
      return;
    }

    throw new Error('Chrome launch aborted because the service is shutting down.');
  }

  private resolveBrowserBinary(): string {
    const configuredBinary = this.configuration.chromeBinary;
    const isLinuxArm64 = process.platform === 'linux' && process.arch === 'arm64';

    if (!isLinuxArm64) {
      return configuredBinary;
    }

    const chromiumCandidates = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'chromium',
      'chromium-browser'
    ];

    for (const candidate of chromiumCandidates) {
      if (candidate.startsWith('/')) {
        try {
          accessSync(candidate);
          this.logger.log(`Detected linux/arm64. Using Chromium binary at "${candidate}".`);
          return candidate;
        } catch {
          continue;
        }
      }

      const probe = spawnSync('which', [candidate], { stdio: 'ignore' });
      if (probe.status === 0) {
        this.logger.log(`Detected linux/arm64. Using Chromium binary "${candidate}" from PATH.`);
        return candidate;
      }
    }

    this.logger.warn(
      `Detected linux/arm64 but no Chromium binary was found. Falling back to configured binary "${configuredBinary}".`
    );
    return configuredBinary;
  }

  private async waitForCdp(): Promise<void> {
    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();
    let lastError: unknown;

    while (Date.now() - start < timeout) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.configuration.chromeCdpRequestTimeoutMs);

      try {
        const response = await fetch(`http://${this.cdpHost}:${this.cdpPort}/json/version`, {
          signal: controller.signal
        });
        if (response.ok) {
          this.logger.log(`CDP endpoint is ready at ${this.cdpHost}:${this.cdpPort}.`);
          return;
        }
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }

      await new Promise((resolve) => setTimeout(resolve, this.configuration.chromeCdpPollIntervalMs));
    }

    throw new Error(
      `CDP endpoint did not become available in time at ${this.cdpHost}:${this.cdpPort}${lastError ? ` (${String(lastError)})` : ''}`
    );
  }

  private async openHomePage(): Promise<void> {
    const selectedTarget = await this.waitForPageTarget();
    if (!selectedTarget) {
      throw new Error('No page target available in Chrome');
    }

    this.logger.log(`Using page target ${String((selectedTarget as { id?: string }).id ?? 'unknown')}.`);
    const client = await CDP({ host: this.cdpHost, port: this.cdpPort, target: selectedTarget });

    try {
      const { Page, Runtime } = client;
      await Page.enable();
      await Runtime.enable();
      await Page.bringToFront();
      const locationResult = await Runtime.evaluate({
        expression: 'window.location.href',
        returnByValue: true
      });
      const currentUrl = String(locationResult.result?.value ?? '');
      this.logger.log(`Current page URL before automation: ${currentUrl}`);
      if (!currentUrl.startsWith(this.configuration.scraperHomeUrl)) {
        await Page.navigate({ url: this.configuration.scraperHomeUrl });
        await this.waitForPageLoad(Page);
      }
      await this.executeMainPageWithRetry(client, Page, Runtime);
      await this.waitForExpression(
        Runtime,
        "Boolean(document.querySelector('#aside-filters'))"
      );
      await this.filtersService.execute(client);
      await this.propertyListingPaginationService.execute(client);
      this.logger.log('MainPageService finished.');
    } finally {
      await client.close();
    }
  }

  private async waitForPageTarget(): Promise<{ id?: string; url?: string; type?: string } | undefined> {
    const timeoutMs = this.configuration.chromeCdpReadyTimeoutMs;
    const pollIntervalMs = this.configuration.chromeCdpPollIntervalMs;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const targets = await CDP.List({ host: this.cdpHost, port: this.cdpPort });
      const pageTargets = [...targets]
        .filter((target: { type?: string }) => target.type === 'page')
        .filter((target: { url?: string }) => {
          const url = (target.url ?? '').trim().toLowerCase();
          return !url.startsWith('devtools://');
        });

      const preferredTarget = pageTargets.find((target: { url?: string }) => {
        const url = (target.url ?? '').trim();
        return url.startsWith(this.configuration.scraperHomeUrl);
      }) ?? pageTargets[0] ?? [...targets].reverse().find((target: { type?: string }) => target.type === 'page');

      if (preferredTarget) {
        return preferredTarget as { id?: string; url?: string; type?: string };
      }

      await this.sleep(pollIntervalMs);
    }

    return undefined;
  }

  private async recoverIfOriginError(Page: { reload(params?: { ignoreCache?: boolean }): Promise<void>; loadEventFired(cb: () => void): void }, Runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const hasOriginError = await this.hasOriginError(Runtime);
      if (!hasOriginError) {
        return;
      }

      this.logger.warn(`Detected origin error page (attempt ${attempt}/${maxRetries}). Reloading in 1 second.`);
      await this.sleep(this.configuration.chromeOriginErrorReloadWaitMs);
      await Page.reload({ ignoreCache: true });
      await this.waitForPageLoad(Page);
    }

    throw new Error('Origin error page persisted after automatic reload attempts.');
  }

  private async executeMainPageWithRetry(
    client: {
      Runtime: {
        enable(): Promise<void>;
        evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
      };
    },
    Page: { navigate(params: { url: string }): Promise<void>; reload(params?: { ignoreCache?: boolean }): Promise<void>; loadEventFired(cb: () => void): void },
    Runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.recoverIfOriginError(Page, Runtime);
        await this.mainPageService.execute(
          client,
          this.configuration.mainSearchArea,
          this.configuration.scraperHomeUrl
        );
        await this.recoverIfOriginError(Page, Runtime);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isOriginErrorVisible = await this.hasOriginError(Runtime);

        if (attempt === maxAttempts) {
          throw error;
        }

        this.logger.warn(
          `Main page flow failed (attempt ${attempt}/${maxAttempts}): ${message}. Reloading home and retrying.`
        );
        await this.sleep(this.configuration.chromeOriginErrorReloadWaitMs);

        if (isOriginErrorVisible) {
          await Page.reload({ ignoreCache: true });
        } else {
          await Page.navigate({ url: this.configuration.scraperHomeUrl });
        }
        await this.waitForPageLoad(Page);
      }
    }
  }

  private async hasOriginError(Runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> }): Promise<boolean> {
    const evaluation = await Runtime.evaluate({
      expression: `(() => {
        const title = (document.title || '').toLowerCase();
        const text = (document.body?.innerText || '').toLowerCase();
        return title.includes('425 unknown error')
          || title.includes('unknown error')
          || text.includes('error 425 unknown error')
          || text.includes('error 425')
          || text.includes('unknown error')
          || text.includes('error 54113')
          || text.includes('varnish cache server');
      })()`,
      returnByValue: true
    });

    return evaluation.result?.value === true;
  }

  private async waitForPageLoad(Page: { loadEventFired(cb: () => void): void }): Promise<void> {
    await new Promise<void>((resolve) => {
      Page.loadEventFired(() => resolve());
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isBrowserBinaryMissingError(error: unknown): boolean {
    const errnoError = error as NodeJS.ErrnoException | undefined;
    if (errnoError?.code === 'ENOENT') {
      return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    return message.includes('ENOENT');
  }

  private closeChromeLogFds(): void {
    if (this.chromeStdoutFd !== undefined) {
      closeSync(this.chromeStdoutFd);
      this.chromeStdoutFd = undefined;
    }
    if (this.chromeStderrFd !== undefined) {
      closeSync(this.chromeStderrFd);
      this.chromeStderrFd = undefined;
    }
  }

  private async waitForExpression(
    Runtime: { evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }> },
    expression: string
  ): Promise<void> {
    const timeout = this.configuration.chromeExpressionTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const evaluation = await Runtime.evaluate({
        expression,
        returnByValue: true
      });

      if (evaluation.result?.value === true) {
        return;
      }

      await this.sleep(this.configuration.chromeExpressionPollIntervalMs);
    }

    throw new Error(`Timeout waiting for expression: ${expression}`);
  }

  private async handleUnexpectedChromeExit(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    const codeText = code === null ? 'null' : String(code);
    const signalText = signal ?? 'null';
    this.logger.error(`Chrome process exited unexpectedly (code=${codeText}, signal=${signalText}).`);

    const cdpStillReachable = await this.isCdpReachableAfterExit();
    if (cdpStillReachable) {
      this.logger.warn('Chrome launcher process exited, but CDP is still reachable. Continuing without shutting down.');
      return;
    }

    await this.holdForDebug('CDP connection to the browser was lost.');
  }

  private async isCdpReachableAfterExit(): Promise<boolean> {
    const attempts = 5;
    const waitMs = 250;

    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.configuration.chromeCdpRequestTimeoutMs);
      try {
        const response = await fetch(`http://${this.cdpHost}:${this.cdpPort}/json/version`, {
          signal: controller.signal
        });
        if (response.ok) {
          return true;
        }
      } catch {
        // Keep retrying; this is expected while Chrome is transitioning.
      } finally {
        clearTimeout(timer);
      }

      await this.sleep(waitMs);
    }

    return false;
  }

  private async holdForDebug(reason: string): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    if (this.debugHoldInProgress) {
      this.logger.warn('Debug hold is already active; keeping current hold window.');
      return;
    }

    this.debugHoldInProgress = true;
    const waitSeconds = Math.floor(this.browserFailureHoldMs / 1000);

    this.logger.error(`Browser failure detected: ${reason}`);
    this.logger.error(
      `Keeping microservice alive for ${waitSeconds} seconds so the pod can be inspected.`
    );

    try {
      await this.sleep(this.browserFailureHoldMs);
    } finally {
      this.debugHoldInProgress = false;
      this.logger.warn('Debug hold finished. Browser automation is still stopped.');
    }
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
