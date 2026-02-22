import { Injectable } from '@nestjs/common';
import { Configuration } from '../../../config/configuration';
import { PropertyFeatureGroup } from '../../../model/property/property-feature-group.model';
import { PropertyImage } from '../../../model/property/property-image.model';
import { PropertyMainFeatures } from '../../../model/property/property-main-features.model';
import { Property } from '../../../model/property/property.model';
import { MongoDatabaseService } from '../../mongodb/mongo-database.service';
import { ImageDownloader } from '../../imagedownload/image-downloader';

type CdpClient = {
  Page: {
    bringToFront(): Promise<void>;
    navigate(params: { url: string }): Promise<{ errorText?: string }>;
  };
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean }): Promise<{ result?: { value?: unknown } }>;
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
  private static readonly DETAIL_CONTAINER_SELECTOR = 'main.detail-container';
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
    private readonly imageDownloader: ImageDownloader
  ) {}

  async loadPropertyUrl(client: CdpClient, url: string): Promise<void> {
    const navigation = await client.Page.navigate({ url });
    if (navigation.errorText) {
      throw new Error(`Navigation failed: ${navigation.errorText}`);
    }
    await this.waitForUrlAndDomComplete(client.Runtime, url);
    await this.scrollPageToBottomAndBackToTop(client.Runtime);
    await this.extendAllPhotos(client.Runtime);
    await this.waitForImagesToLoad(client.Runtime);
    const property = await this.extractPropertyDataFromDOM(client.Runtime, url);
    if (property) {
      const filteredProperty = this.filterPropertyImagesByBlurPattern(property);
      await this.mongoDatabaseService.saveProperty(filteredProperty);
      await this.imageDownloader.waitForPendingImageDownloads();
      await this.imageDownloader.movePropertyImagesFromIncoming(filteredProperty);
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
    const clicked = await this.clickMorePhotosIfExists(runtime);
    if (!clicked) {
      return;
    }

    await this.sleep(this.configuration.propertyDetailPageScrollIntervalMs);
    await this.scrollPageToBottomAndBackToTop(runtime);
  }

  private async waitForImagesToLoad(runtime: RuntimeClient): Promise<void> {
    await this.sleep(this.configuration.propertyDetailPageImagesLoadWaitMs);

    const timeoutMs = Math.max(this.configuration.propertyDetailPageImagesLoadWaitMs, 3000);
    const start = Date.now();

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
          const hasCurrent = Boolean((img.currentSrc || '').trim());
          const hasSrc = Boolean((img.getAttribute('src') || '').trim());
          const hasService = Boolean((img.getAttribute('data-service') || '').trim());
          const isLoaded = (img.complete && img.naturalWidth > 0) || hasCurrent || hasSrc || hasService;
          if (isLoaded) {
            loaded += 1;
          }
        }

        return { total: images.length, loaded };
      })()`);

      if (progress.total === 0 || progress.loaded >= progress.total) {
        return;
      }

      await this.sleep(Math.max(150, this.configuration.propertyDetailPageScrollIntervalMs));
    }
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

  private async clickMorePhotosIfExists(
    runtime: RuntimeClient
  ): Promise<boolean> {
    const result = await runtime.evaluate({
      expression: `(() => {
        const button = document.querySelector(${JSON.stringify(PropertyDetailPageService.MORE_PHOTOS_BUTTON_SELECTOR)});
        if (!button) {
          return false;
        }
        if (typeof button.click === 'function') {
          button.click();
        } else {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
        return true;
      })()`,
      returnByValue: true
    });

    return result.result?.value === true;
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
