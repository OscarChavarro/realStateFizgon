import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { accessSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import CDP = require('chrome-remote-interface');
import { Configuration } from '../../config/configuration';
import { ProxyService } from '@real-state-fizgon/proxy';
import { RabbitMqService } from '../rabbitmq/rabbit-mq.service';
import { PropertyDetailPageService } from './property/property-detail-page.service';
import { MongoDatabaseService } from '../mongodb/mongo-database.service';
import { ImageDownloader } from '../imagedownload/image-downloader';

type CdpClient = {
  Page: {
    enable(): Promise<void>;
    navigate(params: { url: string }): Promise<{ errorText?: string }>;
    bringToFront(): Promise<void>;
  };
  Runtime: {
    enable(): Promise<void>;
    evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }>;
  };
  Network: {
    enable(): Promise<void>;
    responseReceived(callback: (event: unknown) => void): void;
    loadingFinished(callback: (event: unknown) => void): void;
    loadingFailed(callback: (event: unknown) => void): void;
    getResponseBody(params: { requestId: string }): Promise<{ body: string; base64Encoded: boolean }>;
  };
  close(): Promise<void>;
};

@Injectable()
export class ChromeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChromeService.name);
  private readonly proxyService = new ProxyService();
  private readonly cdpHost = '127.0.0.1';
  private chromeProcess?: ChildProcess;
  private chromeStdoutFd?: number;
  private chromeStderrFd?: number;
  private cdpClient?: CdpClient;
  private shuttingDown = false;

  constructor(
    private readonly configuration: Configuration,
    private readonly rabbitMqService: RabbitMqService,
    private readonly propertyDetailPageService: PropertyDetailPageService,
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly imageDownloader: ImageDownloader
  ) {}

  async onModuleInit(): Promise<void> {
    await this.imageDownloader.validateImageDownloadFolder();
    await this.mongoDatabaseService.validateConnectionOrExit();
    await this.proxyService.validateProxyAccessOrWait({
      enabled: this.configuration.proxyEnabled,
      host: this.configuration.proxyHost,
      port: this.configuration.proxyPort,
      retryWaitMs: this.configuration.chromeBrowserLaunchRetryWaitMs,
      logger: this.logger
    });
    await this.launchChrome();
    this.cdpClient = await this.openCdpClient();

    await this.rabbitMqService.consumePropertyUrls(async (url) => {
      await this.processPropertyUrlWithRetry(url);
      await this.sleep(this.configuration.delayAfterUrlMs);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;

    if (this.cdpClient) {
      await this.cdpClient.close();
      this.cdpClient = undefined;
    }

    if (this.chromeProcess && !this.chromeProcess.killed) {
      this.chromeProcess.kill('SIGTERM');
    }
  }

  private async processPropertyUrlWithRetry(url: string): Promise<void> {
    if (await this.mongoDatabaseService.propertyExistsByUrl(url)) {
      return;
    }

    const maxAttempts = this.configuration.consumerMaxUrlAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.openPropertyUrlOnce(url);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt < maxAttempts) {
          this.logger.warn(`Error loading "${url}" (attempt ${attempt}/${maxAttempts}): ${message}. Retrying.`);
          await this.sleep(this.configuration.delayAfterUrlMs);
          continue;
        }

        this.logger.error(`Failed to process URL after ${maxAttempts} attempts: ${url}`);
        this.logger.error('Stopping micro service to avoid losing property information.');
        process.exit(1);
      }
    }
  }

  private async openPropertyUrlOnce(url: string): Promise<void> {
    await this.ensureCdpClient();

    this.logger.log(`Processing: ${url}`);
    const client = this.cdpClient;
    if (!client) {
      throw new Error('CDP client is not initialized.');
    }

    try {
      await this.propertyDetailPageService.loadPropertyUrl(client, url);
      return;
    } catch (error) {
      if (!this.isClosedWebSocketError(error)) {
        throw error;
      }

      this.logger.warn('CDP websocket was closed. Reconnecting CDP client and retrying current URL once.');
      await this.reconnectCdpClient();
      if (!this.cdpClient) {
        throw new Error('CDP client is not initialized after reconnect.');
      }
      await this.propertyDetailPageService.loadPropertyUrl(this.cdpClient, url);
      return;
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
        this.chromeProcess = spawn(
          browserBinary,
          [
            `--remote-debugging-port=${this.configuration.chromeCdpPort}`,
            `--user-data-dir=${this.configuration.chromePath}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--new-window',
            ...this.configuration.chromiumOptions,
            'about:blank'
          ],
          {
            stdio: ['ignore', this.chromeStdoutFd, this.chromeStderrFd]
          }
        );

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

      this.chromeProcess.once('exit', (code, signal) => {
        this.closeChromeLogFds();
        this.handleUnexpectedChromeExit(code, signal);
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

  private async openCdpClient(): Promise<CdpClient> {
    const createdTarget = await (CDP as unknown as {
      New(params: { host: string; port: number; url: string }): Promise<{ id?: string }>;
    }).New({
      host: this.cdpHost,
      port: this.configuration.chromeCdpPort,
      url: 'about:blank'
    });

    const targets = await CDP.List({ host: this.cdpHost, port: this.configuration.chromeCdpPort });
    const pageTarget = targets.find((target: { id?: string; type?: string }) => target.id === createdTarget.id && target.type === 'page');
    if (!pageTarget) {
      throw new Error('No page target available in Chrome.');
    }

    const client = await CDP({
      host: this.cdpHost,
      port: this.configuration.chromeCdpPort,
      target: pageTarget
    }) as CdpClient;

    await client.Page.enable();
    await client.Runtime.enable();
    await this.imageDownloader.initializeNetworkCapture(client);
    await client.Page.bringToFront();
    this.logger.log(`Connected to dedicated CDP page target ${String((pageTarget as { id?: string }).id ?? 'unknown')}.`);
    return client;
  }

  private async waitForCdp(): Promise<void> {
    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.configuration.chromeCdpRequestTimeoutMs);

      try {
        const response = await fetch(`http://127.0.0.1:${this.configuration.chromeCdpPort}/json/version`, {
          signal: controller.signal
        });
        if (response.ok) {
          return;
        }
      } catch {
        // Keep polling until timeout.
      } finally {
        clearTimeout(timer);
      }

      await this.sleep(this.configuration.chromeCdpPollIntervalMs);
    }

    throw new Error(`CDP endpoint did not become available on port ${this.configuration.chromeCdpPort}.`);
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

  private async ensureCdpClient(): Promise<void> {
    if (!this.cdpClient) {
      this.cdpClient = await this.openCdpClient();
      return;
    }

    try {
      await this.cdpClient.Runtime.evaluate({ expression: 'true', returnByValue: true });
    } catch (error) {
      if (!this.isClosedWebSocketError(error)) {
        throw error;
      }

      await this.reconnectCdpClient();
    }
  }

  private async reconnectCdpClient(): Promise<void> {
    if (this.cdpClient) {
      try {
        await this.cdpClient.close();
      } catch {
        // Ignore close failures during reconnect.
      }
      this.cdpClient = undefined;
    }

    await this.waitForCdp();
    this.cdpClient = await this.openCdpClient();
  }

  private isClosedWebSocketError(error: unknown): boolean {
    const text = error instanceof Error ? error.message : String(error);
    return text.includes('WebSocket is not open')
      || text.includes('readyState 3')
      || text.includes('socket hang up');
  }

  private handleUnexpectedChromeExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.shuttingDown) {
      return;
    }

    const codeText = code === null ? 'null' : String(code);
    const signalText = signal ?? 'null';
    this.logger.error(`Chrome process exited unexpectedly (code=${codeText}, signal=${signalText}). Exiting micro service.`);
    process.exit(1);
  }
}
