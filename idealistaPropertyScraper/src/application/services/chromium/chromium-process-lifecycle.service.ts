import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { ChromiumUserAgentTlsService } from 'src/application/services/chromium/chromium-user-agent-tls.service';
import { ChromeConfig } from 'src/infrastructure/config/chrome.config';
import { toErrorMessage } from 'src/infrastructure/error-message';
import { sleep } from 'src/infrastructure/sleep';

@Injectable()
export class ChromiumProcessLifecycleService {
  private readonly logger = new Logger(ChromiumProcessLifecycleService.name);
  private chromeProcess?: ChildProcess;
  private chromeStdoutFd?: number;
  private chromeStderrFd?: number;

  constructor(
    private readonly chromeConfig: ChromeConfig,
    private readonly chromiumUserAgentTlsService: ChromiumUserAgentTlsService
  ) {}

  async launchChromiumProcess(
    cdpPort: number,
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void,
    isShuttingDown: () => boolean
  ): Promise<void> {
    const logsDir = join(process.cwd(), 'output', 'logs');
    mkdirSync(logsDir, { recursive: true });
    const browserBinary = this.chromiumUserAgentTlsService.resolveBrowserBinary(this.logger);

    while (!isShuttingDown()) {
      this.chromeStdoutFd = openSync(join(logsDir, 'chrome_stdout.log'), 'a');
      this.chromeStderrFd = openSync(join(logsDir, 'chrome_stderr.log'), 'a');

      try {
        const chromiumOptions = this.resolveChromiumOptions(browserBinary);
        this.chromeProcess = spawn(browserBinary, [
          `--remote-debugging-port=${cdpPort}`,
          `--user-data-dir=${this.chromeConfig.chromePath}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--new-window',
          ...chromiumOptions,
          'about:blank'
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
          const waitMs = this.chromeConfig.chromeBrowserLaunchRetryWaitMs;
          this.logger.error(
            `Browser binary "${browserBinary}" was not found. Waiting ${Math.floor(waitMs / 1000)} seconds before retrying launch.`
          );
          await sleep(waitMs);
          continue;
        }

        throw error;
      }

      this.logger.log(`Chrome process started with PID ${this.chromeProcess.pid ?? 'unknown'}.`);
      this.chromeProcess.once('exit', (code, signal) => {
        this.closeChromeLogFds();
        onUnexpectedExit(code, signal);
      });

      return;
    }

    throw new Error('Chrome launch aborted because the service is shutting down.');
  }

  stopChromiumProcess(): void {
    if (this.chromeProcess && !this.chromeProcess.killed) {
      this.chromeProcess.kill('SIGTERM');
    }
    this.closeChromeLogFds();
  }

  private isBrowserBinaryMissingError(error: unknown): boolean {
    const errnoError = error as NodeJS.ErrnoException | undefined;
    if (errnoError?.code === 'ENOENT') {
      return true;
    }

    const message = toErrorMessage(error);
    return message.includes('ENOENT');
  }

  private resolveChromiumOptions(browserBinary: string): string[] {
    const configuredOptions = this.chromeConfig.chromiumOptions;
    const baseOptions = configuredOptions.filter(
      (option) => !option.startsWith('--user-agent=')
    );
    const requestedUserAgent =
      this.chromeConfig.chromeUserAgent || this.extractUserAgentOption(configuredOptions);
    const browserVersion = this.chromiumUserAgentTlsService.getBrowserVersion(browserBinary, this.logger);
    const resolvedUserAgent = this.chromiumUserAgentTlsService.resolveUserAgentForLaunch(
      requestedUserAgent,
      browserVersion,
      this.logger
    );

    if (resolvedUserAgent) {
      baseOptions.push(`--user-agent=${resolvedUserAgent}`);
    }

    return baseOptions;
  }

  private extractUserAgentOption(options: string[]): string {
    const match = [...options].reverse().find((option) => option.startsWith('--user-agent='));
    return match ? match.replace('--user-agent=', '').trim() : '';
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

}
