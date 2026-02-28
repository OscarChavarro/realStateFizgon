import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { accessSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { Configuration } from '../../config/configuration';

@Injectable()
export class ChromiumProcessLiveCicleService {
  private readonly logger = new Logger(ChromiumProcessLiveCicleService.name);
  private chromeProcess?: ChildProcess;
  private chromeStdoutFd?: number;
  private chromeStderrFd?: number;

  constructor(private readonly configuration: Configuration) {}

  async launchChromiumProcess(
    cdpPort: number,
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void,
    isShuttingDown: () => boolean
  ): Promise<void> {
    const logsDir = join(process.cwd(), 'output', 'logs');
    mkdirSync(logsDir, { recursive: true });
    const browserBinary = this.resolveBrowserBinary();

    while (!isShuttingDown()) {
      this.chromeStdoutFd = openSync(join(logsDir, 'chrome_stdout.log'), 'a');
      this.chromeStderrFd = openSync(join(logsDir, 'chrome_stderr.log'), 'a');

      try {
        this.chromeProcess = spawn(browserBinary, [
          `--remote-debugging-port=${cdpPort}`,
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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
