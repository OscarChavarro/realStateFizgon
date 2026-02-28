import { spawn } from 'node:child_process';

export type CaptchaSolverOptions = {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  logger?: {
    log?(message: string): void;
    warn?(message: string): void;
    error(message: string): void;
  };
};

export class IdealistaCaptchaSolverService {
  private static missingXdotoolReported = false;

  async moveCursor(options: CaptchaSolverOptions = {}): Promise<void> {
    const x0 = Number(options.x0 ?? 0);
    const y0 = Number(options.y0 ?? 0);
    const x1 = Number(options.x1 ?? 1024);
    const y1 = Number(options.y1 ?? 1024);

    await this.runXdotool(['mousemove', String(x0), String(y0)], options.logger);
    await this.runXdotool(['mousemove', String(x1), String(y1)], options.logger);
  }

  private runXdotool(args: string[], logger?: { error(message: string): void }): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('xdotool', args);

      process.once('error', (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          this.logMissingXdotoolOnce(logger);
          resolve();
          return;
        }

        reject(error);
      });

      process.once('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`xdotool exited with code ${String(code)}.`));
      });
    });
  }

  private logMissingXdotoolOnce(logger?: { error(message: string): void }): void {
    if (IdealistaCaptchaSolverService.missingXdotoolReported) {
      return;
    }

    IdealistaCaptchaSolverService.missingXdotoolReported = true;
    const message = 'Captcha solver could not run because xdotool is not installed or not available in PATH.';
    if (logger) {
      logger.error(message);
      return;
    }

    console.error(message);
  }
}
