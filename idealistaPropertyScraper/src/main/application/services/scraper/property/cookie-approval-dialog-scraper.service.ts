import { Injectable, Logger } from '@nestjs/common';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { sleep } from 'src/infrastructure/sleep';

type RuntimeClient = {
  evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

@Injectable()
export class CookieApprovalDialogScraperService {
  private readonly logger = new Logger(CookieApprovalDialogScraperService.name);

  constructor(private readonly scraperConfig: ScraperConfig) {}

  async acceptCookiesIfVisible(runtime: RuntimeClient): Promise<void> {
    const clicked = await this.evaluateExpression<boolean>(runtime, `(() => {
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

      const dialog = document.getElementById('didomi-noti');
      if (!isVisible(dialog)) {
        return false;
      }

      const agreeButton = document.getElementById('didomi-noti-agree-button');
      if (!isVisible(agreeButton)) {
        return false;
      }

      if (typeof agreeButton.click === 'function') {
        agreeButton.click();
      } else {
        agreeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }

      return true;
    })()`);

    if (!clicked) {
      return;
    }

    await sleep(this.scraperConfig.cookieApprovalDialogWaitMs);
    this.logger.log('Accepted Didomi cookie approval dialog.');
    await sleep(this.scraperConfig.cookieApprovalDialogWaitMs);
  }

  private async evaluateExpression<T>(runtime: RuntimeClient, expression: string): Promise<T> {
    const response = await runtime.evaluate({
      expression,
      returnByValue: true
    });

    return response.result?.value as T;
  }

}
