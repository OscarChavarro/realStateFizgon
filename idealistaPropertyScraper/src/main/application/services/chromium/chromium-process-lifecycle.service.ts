import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromiumUserAgentTlsService } from 'application/services/chromium/chromium-user-agent-tls.service';
import { INPUT_OUTPUT_FILE_ACCESS_PORT } from 'ports/outbound/input-output/input-output-file-access.port.token';
import { INPUT_OUTPUT_PATH_PORT } from 'ports/outbound/input-output/input-output-path.port.token';
import { CHROME_SETTINGS_PORT } from 'ports/outbound/settings/chrome-settings.port.token';
import type { ChromeSettingsPort } from 'ports/outbound/settings/chrome-settings.port';
import { ERROR_MESSAGE_PORT } from 'ports/outbound/observability/error-message.port.token';
import { OPERATING_SYSTEM_PROCESS_CONTROL_PORT } from 'ports/outbound/operating-system/operating-system-process-control.port.token';
import { SLEEP_PORT } from 'ports/outbound/timing/sleep.port.token';

import type { ErrorMessagePort } from 'ports/outbound/observability/error-message.port';
import type { InputOutputFileAccessPort } from 'ports/outbound/input-output/input-output-file-access.port';
import type { InputOutputPathPort } from 'ports/outbound/input-output/input-output-path.port';
import type {
  OperatingSystemProcessControlPort,
  OperatingSystemSpawnedProcess
} from 'ports/outbound/operating-system/operating-system-process-control.port';
import type { SleepPort } from 'ports/outbound/timing/sleep.port';

@Injectable()
export class ChromiumProcessLifecycleService {
  private readonly logger = new Logger(ChromiumProcessLifecycleService.name);
  private chromeProcess?: OperatingSystemSpawnedProcess;
  private chromeStdoutFd?: number;
  private chromeStderrFd?: number;
  private controlledStopInProgress = false;

  constructor(
    @Inject(CHROME_SETTINGS_PORT)
    private readonly chromeConfig: ChromeSettingsPort,
    @Inject(INPUT_OUTPUT_PATH_PORT)
    private readonly inputOutputPathPort: InputOutputPathPort,
    @Inject(INPUT_OUTPUT_FILE_ACCESS_PORT)
    private readonly inputOutputFileAccessPort: InputOutputFileAccessPort,
    private readonly chromiumUserAgentTlsService: ChromiumUserAgentTlsService,
    @Inject(ERROR_MESSAGE_PORT)
    private readonly errorMessagePort: ErrorMessagePort,
    @Inject(OPERATING_SYSTEM_PROCESS_CONTROL_PORT)
    private readonly operatingSystemProcessControlPort: OperatingSystemProcessControlPort,
    @Inject(SLEEP_PORT)
    private readonly sleepPort: SleepPort
  ) {}

  async launchChromiumProcess(
    cdpPort: number,
    onUnexpectedExit: (code: number | null, signal: NodeJS.Signals | null) => void,
    isShuttingDown: () => boolean
  ): Promise<void> {
    const logsDir = this.inputOutputPathPort.join(process.cwd(), 'output', 'logs');
    this.inputOutputFileAccessPort.ensureDirectory(logsDir);
    const browserBinary = this.chromiumUserAgentTlsService.resolveBrowserBinary(this.logger);

    while (!isShuttingDown()) {
      this.chromeStdoutFd = this.inputOutputFileAccessPort.openFileForAppend(
        this.inputOutputPathPort.join(logsDir, 'chrome_stdout.log')
      );
      this.chromeStderrFd = this.inputOutputFileAccessPort.openFileForAppend(
        this.inputOutputPathPort.join(logsDir, 'chrome_stderr.log')
      );

      try {
        const chromiumOptions = this.resolveChromiumOptions(browserBinary);
        this.chromeProcess = this.operatingSystemProcessControlPort.spawn(
          browserBinary,
          [
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${this.chromeConfig.chromePath}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--new-window',
            ...chromiumOptions,
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
          const waitMs = this.chromeConfig.chromeBrowserLaunchRetryWaitMs;
          this.logger.error(
            `Browser binary "${browserBinary}" was not found. Waiting ${Math.floor(waitMs / 1000)} seconds before retrying launch.`
          );
          await this.sleepPort.sleep(waitMs);
          continue;
        }

        throw error;
      }

      this.logger.log(`Chrome process started with PID ${this.chromeProcess.pid ?? 'unknown'}.`);
      this.chromeProcess.once('exit', (code, signal) => {
        this.closeChromeLogFds();
        if (this.controlledStopInProgress) {
          this.controlledStopInProgress = false;
          return;
        }
        onUnexpectedExit(code, signal);
      });

      return;
    }

    throw new Error('Chrome launch aborted because the service is shutting down.');
  }

  stopChromiumProcess(): void {
    if (this.chromeProcess && this.chromeProcess.pid && this.isPidAlive(this.chromeProcess.pid)) {
      this.controlledStopInProgress = true;
    }
    if (this.chromeProcess && !this.chromeProcess.killed) {
      this.chromeProcess.kill('SIGTERM');
    }
    this.closeChromeLogFds();
  }

  forceKillChromiumProcess(): void {
    const pid = this.chromeProcess?.pid;
    if (!pid) {
      return;
    }

    if (!this.operatingSystemProcessControlPort.isPidAlive(pid)) {
      return;
    }

    this.controlledStopInProgress = true;
    try {
      this.operatingSystemProcessControlPort.killPid(pid, 'SIGKILL');
      this.logger.warn(`Sent SIGKILL to Chrome process PID ${pid}.`);
    } catch (error) {
      this.logger.warn(`Failed to send SIGKILL to Chrome process PID ${pid}. ${this.errorMessagePort.toErrorMessage(error)}`);
    }
  }

  private isBrowserBinaryMissingError(error: unknown): boolean {
    const errnoError = error as NodeJS.ErrnoException | undefined;
    if (errnoError?.code === 'ENOENT') {
      return true;
    }

    const message = this.errorMessagePort.toErrorMessage(error);
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
      this.inputOutputFileAccessPort.closeFileDescriptor(this.chromeStdoutFd);
      this.chromeStdoutFd = undefined;
    }
    if (this.chromeStderrFd !== undefined) {
      this.inputOutputFileAccessPort.closeFileDescriptor(this.chromeStderrFd);
      this.chromeStderrFd = undefined;
    }
  }

  private isPidAlive(pid: number): boolean {
    return this.operatingSystemProcessControlPort.isPidAlive(pid);
  }

}
