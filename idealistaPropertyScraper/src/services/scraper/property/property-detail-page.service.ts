import { Injectable, Logger } from '@nestjs/common';
import { Configuration } from '../../../config/configuration';
import { PropertyFeatureGroup } from '../../../model/property/property-feature-group.model';
import { PropertyImage } from '../../../model/property/property-image.model';
import { PropertyMainFeatures } from '../../../model/property/property-main-features.model';
import { Property } from '../../../model/property/property.model';
import { MongoDatabaseService } from '../../mongodb/mongo-database.service';
import { ImageDownloader } from '../../imagedownload/image-downloader';
import { CookieAprovalDialogScraperService } from './cookie-aproval-dialog-scraper.service';
import { IdealistaCaptchaDetectorService } from '@real-state-fizgon/captcha-solvers';

type CdpClient = {
  Page: {
    bringToFront(): Promise<void>;
  };
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
  };
};

type RuntimeClient = {
  evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

type ExtractedPropertyPayload = {
  title: string | null;
  location: string | null;
  infoFeatures: string[];
  advertiserComment: string | null;
  featureGroups: Array<{ name: string; items: string[] }>;
  publicationAge: string | null;
  images: Array<{ url: string; title: string | null }>;
};

@Injectable()
export class PropertyDetailPageService {
  private readonly logger = new Logger(PropertyDetailPageService.name);
  private readonly captchaDetectorService = new IdealistaCaptchaDetectorService();
  private static readonly DETAIL_CONTAINER_SELECTOR = 'main.detail-container';
  private static readonly DEACTIVATED_DETAIL_SELECTOR = 'section.deactivated-detail';
  private static readonly SIDE_CONTENT_SELECTOR = '#side-content';
  private static readonly TITLE_SELECTOR = '.main-info__title-main';
  private static readonly LOCATION_SELECTOR = '.main-info__title-minor';
  private static readonly INFO_FEATURES_SELECTOR = '.info-features > span';
  private static readonly ADVERTISER_COMMENT_SELECTOR = '.comment .adCommentsLanguage, .comment p';
  private static readonly DETAILS_CONTAINER_SELECTOR = '.details-property';
  private static readonly DETAIL_GROUP_TITLE_SELECTOR = '.details-property-h2';
  private static readonly DETAIL_GROUP_ITEMS_SELECTOR = 'li';
  private static readonly DETAIL_GROUP_CONTAINER_CLASS = 'details-property_features';
  private static readonly LAST_UPDATE_SELECTOR = '.time-since-last-modification';
  private static readonly PHOTOS_CONTAINER_SELECTOR = '.photos-container';
  private static readonly PHOTO_PLACEHOLDER_SELECTOR = '.placeholder-multimedia';
  private static readonly PHOTO_IMAGE_SELECTOR = 'img';
  private static readonly PICTURE_SOURCE_SELECTOR = 'source[srcset]';
  private static readonly IMG_ELEMENT_SELECTOR = 'img';
  private static readonly MORE_PHOTOS_BUTTON_SELECTOR = 'a.btn.regular.more-photos';

  constructor(
    private readonly configuration: Configuration,
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly imageDownloader: ImageDownloader,
    private readonly cookieAprovalDialogScraperService: CookieAprovalDialogScraperService
  ) {}

  async loadPropertyUrl(client: CdpClient, url: string): Promise<void> {
    const clicked = await this.clickPropertyLinkFromResults(client.Runtime, url);
    if (!clicked) {
      throw new Error(`Property URL is not visible in current results DOM and cannot be clicked: ${url}`);
    }

    try {
      await this.waitForUrlAndDomComplete(client.Runtime, url);
      await this.captchaDetectorService.panicIfCaptchaDetected({
        runtime: client.Runtime,
        logger: this.logger,
        context: `property detail url "${url}"`
      });
      await this.throwIfOriginErrorPage(client.Runtime, url);
      await this.cookieAprovalDialogScraperService.acceptCookiesIfVisible(client.Runtime);
      if (await this.isDeactivatedDetailPage(client.Runtime)) {
        this.logger.warn(`Property URL is no longer available (deactivated-detail): ${url}`);
        await this.mongoDatabaseService.saveClosedProperty(url);
        return;
      }
      await this.scrollPageToBottomAndBackToTop(client.Runtime);
      await this.extendAllPhotos(client.Runtime);
      await this.waitForImagesToLoad(client.Runtime);
      const property = await this.extractPropertyDataFromDOM(client.Runtime, url);
      if (!property) {
        throw new Error(`Property detail container was not found after loading URL: ${url}`);
      }

      const filteredProperty = this.filterPropertyImagesByBlurPattern(property);
      await this.imageDownloader.waitForImageNetworkSettled();
      await this.mongoDatabaseService.saveProperty(filteredProperty);
      await this.imageDownloader.waitForPendingImageDownloads();
      await this.imageDownloader.movePropertyImagesFromIncoming(filteredProperty);
    } finally {
      await this.goBackToSearchResults(client.Runtime);
    }
  }

  async extractPropertyDataFromDOM(runtime: RuntimeClient, url: string): Promise<Property | null> {
    const extractionExpression = `(() => {
      const textOf = (element) => (element?.textContent || '').replace(/\\s+/g, ' ').trim();
      const unique = (values) => Array.from(new Set(values.filter((value) => value.length > 0)));

      const detailContainer = document.querySelector(${JSON.stringify(PropertyDetailPageService.DETAIL_CONTAINER_SELECTOR)});
      if (!detailContainer) {
        return null;
      }

      const isInsideSideContent = (element) =>
        element && typeof element.closest === 'function' && element.closest(${JSON.stringify(PropertyDetailPageService.SIDE_CONTENT_SELECTOR)});

      const title = textOf(detailContainer.querySelector(${JSON.stringify(PropertyDetailPageService.TITLE_SELECTOR)})) || null;
      const location = textOf(detailContainer.querySelector(${JSON.stringify(PropertyDetailPageService.LOCATION_SELECTOR)})) || null;

      const infoFeatures = unique(
        Array.from(detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailPageService.INFO_FEATURES_SELECTOR)}))
          .filter((element) => !isInsideSideContent(element))
          .map((element) => textOf(element))
      );

      let advertiserComment = null;
      const commentCandidates = Array.from(detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailPageService.ADVERTISER_COMMENT_SELECTOR)}))
        .filter((element) => !isInsideSideContent(element));
      for (const candidate of commentCandidates) {
        const text = textOf(candidate);
        if (text.length > 0) {
          advertiserComment = text;
          break;
        }
      }

      const featureGroups = [];
      const detailsRoot = detailContainer.querySelector(${JSON.stringify(PropertyDetailPageService.DETAILS_CONTAINER_SELECTOR)});
      if (detailsRoot) {
        const titles = Array.from(detailsRoot.querySelectorAll(${JSON.stringify(PropertyDetailPageService.DETAIL_GROUP_TITLE_SELECTOR)}));
        for (const titleElement of titles) {
          if (isInsideSideContent(titleElement)) {
            continue;
          }

          const name = textOf(titleElement);
          if (!name) {
            continue;
          }

          let itemsContainer = titleElement.nextElementSibling;
          while (itemsContainer && !itemsContainer.classList.contains(${JSON.stringify(PropertyDetailPageService.DETAIL_GROUP_CONTAINER_CLASS)})) {
            itemsContainer = itemsContainer.nextElementSibling;
          }
          if (!itemsContainer) {
            continue;
          }

          const items = unique(
            Array.from(itemsContainer.querySelectorAll(${JSON.stringify(PropertyDetailPageService.DETAIL_GROUP_ITEMS_SELECTOR)}))
              .map((item) => textOf(item))
          );

          if (items.length > 0) {
            featureGroups.push({ name, items });
          }
        }
      }

      const publicationAge = textOf(detailContainer.querySelector(${JSON.stringify(PropertyDetailPageService.LAST_UPDATE_SELECTOR)})) || null;

      const imageMap = new Map();
      const placeholders = detailContainer.querySelectorAll(
        ${JSON.stringify(`${PropertyDetailPageService.PHOTOS_CONTAINER_SELECTOR} ${PropertyDetailPageService.PHOTO_PLACEHOLDER_SELECTOR}`)}
      );
      for (const placeholder of placeholders) {
        if (isInsideSideContent(placeholder)) {
          continue;
        }

        const imageElement = placeholder.querySelector(${JSON.stringify(PropertyDetailPageService.PHOTO_IMAGE_SELECTOR)});
        if (!imageElement) {
          continue;
        }

        const title = textOf(imageElement.getAttribute('title')) || null;

        let url = '';
        if (imageElement.dataset && typeof imageElement.dataset.service === 'string') {
          url = imageElement.dataset.service.trim();
        }
        if (!url && typeof imageElement.currentSrc === 'string') {
          url = imageElement.currentSrc.trim();
        }
        if (!url && typeof imageElement.getAttribute === 'function') {
          url = (imageElement.getAttribute('src') || '').trim();
        }
        if (!url) {
          const sourceElement = imageElement.closest('picture')?.querySelector(${JSON.stringify(PropertyDetailPageService.PICTURE_SOURCE_SELECTOR)})
            || placeholder.querySelector(${JSON.stringify(PropertyDetailPageService.PICTURE_SOURCE_SELECTOR)});
          const sourceSrcset = (sourceElement?.getAttribute('srcset') || '').trim();
          if (sourceSrcset) {
            url = sourceSrcset.split(',')[0].trim().split(' ')[0].trim();
          }
        }

        if (!url) {
          continue;
        }

        const existing = imageMap.get(url);
        if (!existing || (!existing.title && title)) {
          imageMap.set(url, { url, title });
        }
      }

      const allImages = detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailPageService.IMG_ELEMENT_SELECTOR)});
      for (const imageElement of allImages) {
        if (isInsideSideContent(imageElement)) {
          continue;
        }

        const title = textOf(imageElement.getAttribute('title')) || null;
        const candidates = [];
        if (imageElement.dataset && typeof imageElement.dataset.service === 'string') {
          candidates.push(imageElement.dataset.service);
        }
        if (imageElement.dataset && typeof imageElement.dataset.src === 'string') {
          candidates.push(imageElement.dataset.src);
        }
        candidates.push(imageElement.currentSrc || '');
        candidates.push(imageElement.getAttribute('src') || '');
        candidates.push(imageElement.getAttribute('data-src') || '');

        const parentPicture = imageElement.closest('picture');
        if (parentPicture) {
          const sources = parentPicture.querySelectorAll(${JSON.stringify(PropertyDetailPageService.PICTURE_SOURCE_SELECTOR)});
          for (const source of sources) {
            const srcset = source.getAttribute('srcset') || '';
            candidates.push(srcset);
          }
        }

        for (const candidate of candidates) {
          if (!candidate) {
            continue;
          }

          const firstCandidate = candidate.split(',')[0].trim().split(' ')[0].trim();
          if (!firstCandidate) {
            continue;
          }

          const existing = imageMap.get(firstCandidate);
          if (!existing || (!existing.title && title)) {
            imageMap.set(firstCandidate, { url: firstCandidate, title });
          }
          break;
        }
      }

      return {
        title,
        location,
        infoFeatures,
        advertiserComment,
        featureGroups,
        publicationAge,
        images: Array.from(imageMap.values())
      };
    })()`;

    const rawData = await this.evaluateExpression<ExtractedPropertyPayload | null>(runtime, extractionExpression);
    if (!rawData) {
      return null;
    }

    return this.mapExtractedPayloadToProperty(rawData, url);
  }

  async extendAllPhotos(runtime: RuntimeClient): Promise<void> {
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
        const detailContainer = document.querySelector(${JSON.stringify(PropertyDetailPageService.DETAIL_CONTAINER_SELECTOR)});
        if (!detailContainer) {
          return { total: 0, loaded: 0 };
        }

        const images = Array.from(detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailPageService.IMG_ELEMENT_SELECTOR)}))
          .filter((img) => !img.closest(${JSON.stringify(PropertyDetailPageService.SIDE_CONTENT_SELECTOR)}));

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

  private async waitForUrlAndDomComplete(
    runtime: RuntimeClient,
    targetUrl: string
  ): Promise<void> {
    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const evaluation = await runtime.evaluate({
        expression: `(() => {
          const currentNoHash = window.location.href.split('#')[0];
          const targetNoHash = ${JSON.stringify(targetUrl)}.split('#')[0];
          const sameUrl = currentNoHash === targetNoHash;
          const isComplete = document.readyState === 'complete';
          return sameUrl && isComplete;
        })()`,
        returnByValue: true
      });

      if (evaluation.result?.value === true) {
        return;
      }

      await this.sleep(this.configuration.chromeCdpPollIntervalMs);
    }

    throw new Error(`Timeout waiting for target URL to load: ${targetUrl}`);
  }

  private async clickPropertyLinkFromResults(runtime: RuntimeClient, targetUrl: string): Promise<boolean> {
    return await this.evaluateExpression<boolean>(runtime, `(() => {
      const normalizeUrl = (value) => {
        if (!value || typeof value !== 'string') {
          return null;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return null;
        }

        let parsed;
        try {
          parsed = new URL(trimmed, window.location.origin);
        } catch {
          return null;
        }

        const match = parsed.pathname.match(/^\\/inmueble\\/(\\d+)\\/?/);
        if (!match) {
          return null;
        }

        return parsed.origin + '/inmueble/' + match[1] + '/';
      };

      const targetNormalized = normalizeUrl(${JSON.stringify(targetUrl)});
      if (!targetNormalized) {
        return false;
      }

      const anchors = Array.from(document.querySelectorAll('article.item a.item-link[href], article.item a[href*="/inmueble/"]'));
      const link = anchors.find((anchor) => normalizeUrl(anchor.getAttribute('href') || '') === targetNormalized);
      if (!link) {
        return false;
      }

      if (typeof link.click === 'function') {
        link.click();
      } else {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }

      return true;
    })()`);
  }

  private async goBackToSearchResults(runtime: RuntimeClient): Promise<void> {
    await runtime.evaluate({
      expression: 'window.history.back(); true;',
      returnByValue: true
    });

    const timeout = this.configuration.chromeCdpReadyTimeoutMs;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const isReady = await this.evaluateExpression<boolean>(runtime, `(() => {
        const complete = document.readyState === 'complete';
        const hasResults = Boolean(
          document.querySelector('#aside-filters')
          || document.querySelector('.pagination')
          || document.querySelector('article.item')
          || document.querySelector('.items-container')
          || document.querySelector('.item-info-container')
        );
        return complete && hasResults;
      })()`);

      if (isReady) {
        return;
      }

      await this.sleep(this.configuration.chromeCdpPollIntervalMs);
    }

    throw new Error('Timeout waiting to return to search results after detail processing.');
  }

  private async throwIfOriginErrorPage(runtime: RuntimeClient, url: string): Promise<void> {
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
      throw new Error(`Wrong content. `);
    }
  }

  private async isDeactivatedDetailPage(runtime: RuntimeClient): Promise<boolean> {
    return await this.evaluateExpression<boolean>(runtime, `(() => {
      return document.querySelector(${JSON.stringify(PropertyDetailPageService.DEACTIVATED_DETAIL_SELECTOR)}) !== null;
    })()`);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async scrollPageToBottomAndBackToTop(
    runtime: RuntimeClient
  ): Promise<void> {
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

  private async clickAllMorePhotosIfExists(
    runtime: RuntimeClient
  ): Promise<number> {
    let clicks = 0;
    const maxIterations = 20;

    for (let attempt = 0; attempt < maxIterations; attempt += 1) {
      const clicked = await this.evaluateExpression<boolean>(runtime, `(() => {
        const buttons = Array.from(document.querySelectorAll(${JSON.stringify(PropertyDetailPageService.MORE_PHOTOS_BUTTON_SELECTOR)}));
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

  private mapExtractedPayloadToProperty(payload: ExtractedPropertyPayload, url: string): Property {
    const mainFeatures = this.buildMainFeatures([...payload.infoFeatures]);
    const featureGroups = payload.featureGroups.map(
      (group) => new PropertyFeatureGroup(group.name, group.items)
    );
    const images = payload.images.map((image) => new PropertyImage(image.url, image.title));

    return new Property(
      url,
      payload.title,
      payload.location,
      mainFeatures,
      payload.advertiserComment,
      featureGroups,
      payload.publicationAge,
      images
    );
  }

  private buildMainFeatures(infoFeatures: string[]): PropertyMainFeatures {
    const area = this.findAndRemoveFirst(infoFeatures, (value) => /m²/i.test(value));
    const bedrooms = this.findAndRemoveFirst(infoFeatures, (value) => /\bhab\.?\b|habitaciones?/i.test(value));
    const buildingLocation = this.findAndRemoveFirst(infoFeatures, (value) =>
      /(planta|bajo|ático|interior|exterior|ascensor)/i.test(value)
    );

    return new PropertyMainFeatures(area, bedrooms, buildingLocation, infoFeatures);
  }

  private findAndRemoveFirst(values: string[], predicate: (value: string) => boolean): string | null {
    const index = values.findIndex(predicate);
    if (index < 0) {
      return null;
    }

    const [value] = values.splice(index, 1);
    return value ?? null;
  }

  private filterPropertyImagesByBlurPattern(property: Property): Property {
    const images = property.images.filter((image) => this.isIdealistaBlurUrl(image.url));
    return new Property(
      property.url,
      property.title,
      property.location,
      property.mainFeatures,
      property.advertiserComment,
      property.featureGroups,
      property.publicationAge,
      images
    );
  }

  private isIdealistaBlurUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      const host = url.hostname.toLowerCase();
      if (!(host === 'idealista.com' || host.endsWith('.idealista.com'))) {
        return false;
      }

      return url.pathname.toLowerCase().includes('/blur/');
    } catch {
      return false;
    }
  }

}
