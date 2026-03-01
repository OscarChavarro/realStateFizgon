import { Injectable, Logger } from '@nestjs/common';
import { Configuration } from '../../../config/configuration';
import { RuntimeClient } from './cdp-client.types';

@Injectable()
export class PropertyDetailInteractionService {
  private readonly logger = new Logger(PropertyDetailInteractionService.name);
  private static readonly DETAIL_CONTAINER_SELECTOR = 'main.detail-container';
  private static readonly SIDE_CONTENT_SELECTOR = '#side-content';
  private static readonly IMG_ELEMENT_SELECTOR = 'img';
  private static readonly MORE_PHOTOS_BUTTON_SELECTOR = 'a.btn.regular.more-photos';

  constructor(private readonly configuration: Configuration) {}

  async throwIfOriginErrorPage(runtime: RuntimeClient): Promise<void> {
    const hasOriginError = await this.evaluateExpression<boolean>(runtime, `(() => {
      const title = (document.title || '').toLowerCase();
      const text = (document.body?.innerText || '').toLowerCase();
      return title.includes('425 unknown error')
        || title.includes('unknown error')
        || text.includes('error 425 unknown error')
        || text.includes('error 425')
        || text.includes('unknown error')
        || text.includes('error 54113')
        || text.includes('varnish cache server');
    })()`);

    if (hasOriginError) {
      throw new Error('Wrong content.');
    }
  }

  async revealDetailMedia(runtime: RuntimeClient): Promise<void> {
    await this.scrollPageToBottomAndBackToTop(runtime);
    await this.extendAllPhotos(runtime);
    await this.waitForImagesToLoad(runtime);
  }

  private async extendAllPhotos(runtime: RuntimeClient): Promise<void> {
    await this.sleep(this.configuration.propertyDetailPagePreMediaExpansionWaitMs);
    const clickedCount = await this.clickAllMorePhotosIfExists(runtime);
    if (clickedCount === 0) {
      return;
    }

    await this.sleep(this.configuration.propertyDetailPageScrollIntervalMs);
    await this.scrollPageToBottomAndBackToTop(runtime);
  }

  private async waitForImagesToLoad(runtime: RuntimeClient): Promise<void> {
    await this.sleep(this.configuration.propertyDetailPageImagesLoadWaitMs);

    const timeoutMs = Math.max(this.configuration.propertyDetailPageImagesLoadWaitMs * 4, 8000);
    const start = Date.now();
    let stableIterations = 0;
    let previousLoaded = -1;
    let previousTotal = -1;

    while (Date.now() - start < timeoutMs) {
      const progress = await this.evaluateExpression<{ total: number; loaded: number }>(runtime, `(() => {
        const detailContainer = document.querySelector(${JSON.stringify(PropertyDetailInteractionService.DETAIL_CONTAINER_SELECTOR)});
        if (!detailContainer) {
          return { total: 0, loaded: 0 };
        }

        const images = Array.from(detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailInteractionService.IMG_ELEMENT_SELECTOR)}))
          .filter((img) => !img.closest(${JSON.stringify(PropertyDetailInteractionService.SIDE_CONTENT_SELECTOR)}));

        let loaded = 0;
        for (const img of images) {
          const hasDecodedBitmap = img.complete && img.naturalWidth > 0;
          const hasServiceUrl = Boolean((img.getAttribute('data-service') || '').trim());
          const isLoaded = hasDecodedBitmap || hasServiceUrl;
          if (isLoaded) {
            loaded += 1;
          }
        }

        return { total: images.length, loaded };
      })()`);

      if (progress.total === 0) {
        return;
      }

      if (progress.loaded === progress.total) {
        stableIterations += 1;
        if (stableIterations >= 2) {
          return;
        }
      } else if (progress.loaded === previousLoaded && progress.total === previousTotal) {
        stableIterations += 1;
        if (stableIterations >= 4) {
          this.logger.warn(
            `Image DOM loading stabilized before full completion (${progress.loaded}/${progress.total}). Continuing with best-effort capture.`
          );
          return;
        }
      } else {
        stableIterations = 0;
      }

      previousLoaded = progress.loaded;
      previousTotal = progress.total;
      await this.sleep(Math.max(150, this.configuration.propertyDetailPageScrollIntervalMs));
    }

    this.logger.warn('Timeout waiting for full image DOM load. Continuing with best-effort capture.');
  }

  private async scrollPageToBottomAndBackToTop(runtime: RuntimeClient): Promise<void> {
    const events = Math.max(1, this.configuration.propertyDetailPageScrollEvents);
    const interval = Math.max(0, this.configuration.propertyDetailPageScrollIntervalMs);

    for (let step = 0; step <= events; step += 1) {
      const progress = step / events;
      await runtime.evaluate({
        expression: `(() => {
          const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          window.scrollTo(0, Math.round(maxScroll * ${progress}));
          return true;
        })()`,
        returnByValue: true
      });
      await this.sleep(interval);
    }

    await runtime.evaluate({
      expression: 'window.scrollTo(0, 0); true;',
      returnByValue: true
    });
  }

  private async clickAllMorePhotosIfExists(runtime: RuntimeClient): Promise<number> {
    let clicks = 0;
    const maxIterations = 20;

    for (let attempt = 0; attempt < maxIterations; attempt += 1) {
      const clicked = await this.evaluateExpression<boolean>(runtime, `(() => {
        const buttons = Array.from(document.querySelectorAll(${JSON.stringify(PropertyDetailInteractionService.MORE_PHOTOS_BUTTON_SELECTOR)}));
        if (buttons.length === 0) {
          return false;
        }

        const visibleButton = buttons.find((button) => {
          const style = window.getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }) || buttons[0];

        if (!visibleButton) {
          return false;
        }

        if (typeof visibleButton.click === 'function') {
          visibleButton.click();
        } else {
          visibleButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
        return true;
      })()`);

      if (!clicked) {
        break;
      }

      clicks += 1;
      await this.sleep(this.configuration.propertyDetailPageMorePhotosClickWaitMs);
    }

    return clicks;
  }

  private async evaluateExpression<T>(runtime: RuntimeClient, expression: string): Promise<T> {
    const response = await runtime.evaluate({
      expression,
      returnByValue: true
    });

    return response.result?.value as T;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
