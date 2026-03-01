import { Injectable } from '@nestjs/common';
import { PropertyFeatureGroup } from '../../../model/property/property-feature-group.model';
import { PropertyImage } from '../../../model/property/property-image.model';
import { PropertyMainFeatures } from '../../../model/property/property-main-features.model';
import { Property } from '../../../model/property/property.model';
import { RuntimeClient } from './cdp-client.types';

type ExtractedPropertyPayload = {
  title: string | null;
  location: string | null;
  price: string | null;
  infoFeatures: string[];
  advertiserComment: string | null;
  featureGroups: Array<{ name: string; items: string[] }>;
  publicationAge: string | null;
  images: Array<{ url: string; title: string | null }>;
};

@Injectable()
export class PropertyDetailDomExtractorService {
  private static readonly DETAIL_CONTAINER_SELECTOR = 'main.detail-container';
  private static readonly SIDE_CONTENT_SELECTOR = '#side-content';
  private static readonly TITLE_SELECTOR = '.main-info__title-main';
  private static readonly LOCATION_SELECTOR = '.main-info__title-minor';
  private static readonly PRICE_SELECTOR = '.info-data-price';
  private static readonly PRICE_VALUE_SELECTOR = '.txt-bold';
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

  async extractProperty(runtime: RuntimeClient, url: string): Promise<Property | null> {
    const extractionExpression = `(() => {
      const textOf = (element) => (element?.textContent || '').replace(/\\s+/g, ' ').trim();
      const unique = (values) => Array.from(new Set(values.filter((value) => value.length > 0)));

      const detailContainer = document.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.DETAIL_CONTAINER_SELECTOR)});
      if (!detailContainer) {
        return null;
      }

      const isInsideSideContent = (element) =>
        element && typeof element.closest === 'function' && element.closest(${JSON.stringify(PropertyDetailDomExtractorService.SIDE_CONTENT_SELECTOR)});

      const title = textOf(detailContainer.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.TITLE_SELECTOR)})) || null;
      const location = textOf(detailContainer.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.LOCATION_SELECTOR)})) || null;
      const priceContainer = detailContainer.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.PRICE_SELECTOR)});
      const price = (
        textOf(priceContainer?.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.PRICE_VALUE_SELECTOR)}))
        || textOf(priceContainer)
        || null
      );

      const infoFeatures = unique(
        Array.from(detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailDomExtractorService.INFO_FEATURES_SELECTOR)}))
          .filter((element) => !isInsideSideContent(element))
          .map((element) => textOf(element))
      );

      let advertiserComment = null;
      const commentCandidates = Array.from(detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailDomExtractorService.ADVERTISER_COMMENT_SELECTOR)}))
        .filter((element) => !isInsideSideContent(element));
      for (const candidate of commentCandidates) {
        const text = textOf(candidate);
        if (text.length > 0) {
          advertiserComment = text;
          break;
        }
      }

      const featureGroups = [];
      const detailsRoot = detailContainer.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.DETAILS_CONTAINER_SELECTOR)});
      if (detailsRoot) {
        const titles = Array.from(detailsRoot.querySelectorAll(${JSON.stringify(PropertyDetailDomExtractorService.DETAIL_GROUP_TITLE_SELECTOR)}));
        for (const titleElement of titles) {
          if (isInsideSideContent(titleElement)) {
            continue;
          }

          const name = textOf(titleElement);
          if (!name) {
            continue;
          }

          let itemsContainer = titleElement.nextElementSibling;
          while (itemsContainer && !itemsContainer.classList.contains(${JSON.stringify(PropertyDetailDomExtractorService.DETAIL_GROUP_CONTAINER_CLASS)})) {
            itemsContainer = itemsContainer.nextElementSibling;
          }
          if (!itemsContainer) {
            continue;
          }

          const items = unique(
            Array.from(itemsContainer.querySelectorAll(${JSON.stringify(PropertyDetailDomExtractorService.DETAIL_GROUP_ITEMS_SELECTOR)}))
              .map((item) => textOf(item))
          );

          if (items.length > 0) {
            featureGroups.push({ name, items });
          }
        }
      }

      const publicationAge = textOf(detailContainer.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.LAST_UPDATE_SELECTOR)})) || null;

      const imageMap = new Map();
      const placeholders = detailContainer.querySelectorAll(
        ${JSON.stringify(`${PropertyDetailDomExtractorService.PHOTOS_CONTAINER_SELECTOR} ${PropertyDetailDomExtractorService.PHOTO_PLACEHOLDER_SELECTOR}`)}
      );
      for (const placeholder of placeholders) {
        if (isInsideSideContent(placeholder)) {
          continue;
        }

        const imageElement = placeholder.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.PHOTO_IMAGE_SELECTOR)});
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
          const sourceElement = imageElement.closest('picture')?.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.PICTURE_SOURCE_SELECTOR)})
            || placeholder.querySelector(${JSON.stringify(PropertyDetailDomExtractorService.PICTURE_SOURCE_SELECTOR)});
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

      const allImages = detailContainer.querySelectorAll(${JSON.stringify(PropertyDetailDomExtractorService.IMG_ELEMENT_SELECTOR)});
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
          const sources = parentPicture.querySelectorAll(${JSON.stringify(PropertyDetailDomExtractorService.PICTURE_SOURCE_SELECTOR)});
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
        price,
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

  filterPropertyImagesByBlurPattern(property: Property): Property {
    const images = property.images.filter((image) => this.isIdealistaBlurUrl(image.url));
    return new Property(
      property.url,
      property.title,
      property.location,
      property.price,
      property.mainFeatures,
      property.advertiserComment,
      property.featureGroups,
      property.publicationAge,
      images
    );
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
      payload.price,
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
