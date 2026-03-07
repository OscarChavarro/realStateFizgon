import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { Configuration } from 'src/infrastructure/config/configuration';
import { ChromiumUserAgentTlsService } from 'src/application/services/scraper/chromium/chromium-user-agent-tls.service';

@Injectable()
export class ChromiumProcessLiveCicleService {
  private readonly logger = new Logger(ChromiumProcessLiveCicleService.name);
  private chromeProcess?: ChildProcess;
  private chromeStdoutFd?: number;
  private chromeStderrFd?: number;

  constructor(
    private readonly configuration: Configuration,
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
          `--user-data-dir=${this.configuration.chromePath}`,
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

    const message = error instanceof Error ? error.message : String(error);
    return message.includes('ENOENT');
  }

  private resolveChromiumOptions(browserBinary: string): string[] {
    const configuredOptions = this.configuration.chromiumOptions;
    const baseOptions = configuredOptions.filter(
      (option) => !option.startsWith('--user-agent=')
    );
    const requestedUserAgent =
      this.configuration.chromeUserAgent || this.extractUserAgentOption(configuredOptions);
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
