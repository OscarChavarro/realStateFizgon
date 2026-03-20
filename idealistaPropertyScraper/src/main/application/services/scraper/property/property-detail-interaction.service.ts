import { Injectable, Logger } from '@nestjs/common';
import { OriginErrorDetectorService } from 'application/services/resilience/origin-error-detector.service';
import { ScraperConfig } from 'infrastructure/config/settings/scraper.config';
import { sleep } from 'infrastructure/sleep';

import type { RuntimeClient } from 'ports/outbound/browser/runtime-client.port';
@Injectable()
export class PropertyDetailInteractionService {
  private readonly logger = new Logger(PropertyDetailInteractionService.name);
  private static readonly DETAIL_CONTAINER_SELECTOR = 'main.detail-container';
  private static readonly SIDE_CONTENT_SELECTOR = '#side-content';
  private static readonly IMG_ELEMENT_SELECTOR = 'img';
  private static readonly PICTURE_SOURCE_SELECTOR = 'source[srcset]';
  private static readonly MORE_PHOTOS_BUTTON_SELECTOR = 'a.btn.regular.more-photos';

  constructor(
    private readonly scraperConfig: ScraperConfig,
    private readonly originErrorDetectorService: OriginErrorDetectorService
  ) {}

  async throwIfOriginErrorPage(runtime: RuntimeClient): Promise<void> {
    const hasOriginError = await this.originErrorDetectorService.hasOriginError(runtime);

    if (hasOriginError) {
      throw new Error('Wrong content.');
    }
  }

  async revealDetailMedia(runtime: RuntimeClient): Promise<void> {
    await this.scrollPageToBottomAndBackToTop(runtime);
    await this.extendAllPhotos(runtime);
    await this.requestAllDetailImages(runtime);
    await this.waitForImagesToLoad(runtime);
  }

  private async extendAllPhotos(runtime: RuntimeClient): Promise<void> {
    await sleep(this.scraperConfig.propertyDetailPagePreMediaExpansionWaitMs);
    const clickedCount = await this.clickAllMorePhotosIfExists(runtime);
    if (clickedCount === 0) {
      return;
    }

    await sleep(this.scraperConfig.propertyDetailPageScrollIntervalMs);
    await this.scrollPageToBottomAndBackToTop(runtime);
  }

  private async waitForImagesToLoad(runtime: RuntimeClient): Promise<void> {
    await sleep(this.scraperConfig.propertyDetailPageImagesLoadWaitMs);

    const timeoutMs = Math.max(this.scraperConfig.propertyDetailPageImagesLoadWaitMs * 4, 8000);
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
          const isLoaded = hasDecodedBitmap;
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
      await sleep(Math.max(150, this.scraperConfig.propertyDetailPageScrollIntervalMs));
    }

    this.logger.warn('Timeout waiting for full image DOM load. Continuing with best-effort capture.');
  }

  private async requestAllDetailImages(runtime: RuntimeClient): Promise<void> {
    const queuedCount = await this.evaluateExpression<number>(runtime, `(() => {
      const detailContainer = document.querySelector(${JSON.stringify(PropertyDetailInteractionService.DETAIL_CONTAINER_SELECTOR)});
      if (!detailContainer) {
        return 0;
      }

      const isInsideSideContent = (element) =>
        element && typeof element.closest === 'function' && element.closest(${JSON.stringify(PropertyDetailInteractionService.SIDE_CONTENT_SELECTOR)});
      const normalizeCandidate = (value) => {
        const normalized = (value || '').split(',')[0].trim().split(' ')[0].trim();
        return normalized;
      };
      const queue = [];
      const imageElements = Array.from(detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailInteractionService.IMG_ELEMENT_SELECTOR)}))
        .filter((img) => !isInsideSideContent(img));

      for (const img of imageElements) {
        if (img && typeof img.setAttribute === 'function') {
          img.setAttribute('loading', 'eager');
          img.setAttribute('decoding', 'sync');
        }

        const candidates = [];
        const dataService = (img.getAttribute('data-service') || '').trim();
        const dataSrc = (img.getAttribute('data-src') || '').trim();
        const currentSrc = (img.currentSrc || '').trim();
        const src = (img.getAttribute('src') || '').trim();
        if (dataService) {
          candidates.push(dataService);
        }
        if (dataSrc) {
          candidates.push(dataSrc);
        }
        if (currentSrc) {
          candidates.push(currentSrc);
        }
        if (src) {
          candidates.push(src);
        }

        const picture = img.closest('picture');
        if (picture) {
          const sources = picture.querySelectorAll(${JSON.stringify(PropertyDetailInteractionService.PICTURE_SOURCE_SELECTOR)});
          for (const source of sources) {
            const srcset = (source.getAttribute('srcset') || '').trim();
            if (srcset) {
              candidates.push(srcset);
            }
          }
        }

        for (const candidate of candidates) {
          const normalizedCandidate = normalizeCandidate(candidate);
          if (!normalizedCandidate) {
            continue;
          }

          queue.push(normalizedCandidate);
          if (!src && dataService && typeof img.setAttribute === 'function') {
            img.setAttribute('src', dataService);
          }
          break;
        }
      }

      const uniqueUrls = Array.from(new Set(queue));
      const preloadQueue = [];
      for (const url of uniqueUrls) {
        const preloaded = new Image();
        preloaded.decoding = 'async';
        preloaded.loading = 'eager';
        preloaded.src = url;
        preloadQueue.push(preloaded);
      }
      window.__fizgonImagePreloadQueue = preloadQueue;
      return uniqueUrls.length;
    })()`);

    if (queuedCount > 0) {
      await sleep(Math.max(200, this.scraperConfig.propertyDetailPageScrollIntervalMs));
    }
  }

  private async scrollPageToBottomAndBackToTop(runtime: RuntimeClient): Promise<void> {
    const events = Math.max(1, this.scraperConfig.propertyDetailPageScrollEvents);
    const interval = Math.max(0, this.scraperConfig.propertyDetailPageScrollIntervalMs);

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
      await sleep(interval);
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
      await sleep(this.scraperConfig.propertyDetailPageMorePhotosClickWaitMs);
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

}
