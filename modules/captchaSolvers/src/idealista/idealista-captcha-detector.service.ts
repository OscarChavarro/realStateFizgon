import { IdealistaCaptchaSolverService } from './idealista-captcha-solver.service';

export type RuntimeClient = {
  evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

export type CaptchaDetectionOptions = {
  runtime: RuntimeClient;
  logger?: {
    log(message: string): void;
    warn?(message: string): void;
    error(message: string): void;
  };
  waitMs?: number;
  context?: string;
};

export class IdealistaCaptchaDetectorService {
  private static readonly DEFAULT_WAIT_MS = 3600000;
  private readonly solverService = new IdealistaCaptchaSolverService();

  async panicIfCaptchaDetected(options: CaptchaDetectionOptions): Promise<void> {
    const logger = options?.logger;
    const logError = (message: string): void => {
      if (logger) {
        logger.error(message);
        return;
      }
      console.error(message);
    };

    const context = String(options?.context ?? 'page load');
    const waitMs = Number(options?.waitMs) || IdealistaCaptchaDetectorService.DEFAULT_WAIT_MS;
    const waitSeconds = Math.floor(waitMs / 1000);

    const detected = await this.hasCaptcha(options.runtime);
    if (!detected) {
      return;
    }

    logError(`Scraper has been detected by anti-bot protection (captcha) during ${context}.`);
    await this.solverService.moveCursor({ logger });
    logError(`Pausing scraper for ${waitSeconds} seconds to allow Kubernetes pod analysis.`);
    await this.sleep(waitMs);
  }

  private async hasCaptcha(runtime: RuntimeClient): Promise<boolean> {
    const response = await runtime.evaluate({
      expression: `(() => {
        const isVisible = (element) => {
          if (!element) {
            return false;
          }
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
            && rect.width > 0
            && rect.height > 0;
        };

        const explicitCaptchaContainer = document.getElementById('ddv1-captcha-container');
        if (isVisible(explicitCaptchaContainer)) {
          return true;
        }

        const captchaSelectors = [
          '[id*="captcha" i]',
          '[class*="captcha" i]',
          '[name*="captcha" i]',
          'iframe[src*="captcha" i]',
          '[data-testid*="captcha" i]'
        ];

        for (const selector of captchaSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (isVisible(element)) {
              return true;
            }
          }
        }

        const bodyText = (document.body?.innerText || '').toLowerCase();
        return bodyText.includes('captcha');
      })()`,
      returnByValue: true
    });

    return response.result?.value === true;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
