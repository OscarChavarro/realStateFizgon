import { Injectable } from '@angular/core';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import { DASHBOARD_PAGE_SIZE_OPTIONS } from 'src/app/listing/model/pagination/listing-pagination.model';
import {
  PropertyLabelEntry,
  PropertyLabels,
  PropertyReviewLabel,
  SortCriterion,
  SortDirection,
  SortField
} from 'src/app/listing/model/listing.types';
import { UserPreferencesPayload } from 'src/app/prefs/model/user-preferences-payload.type';

type NormalizedUserPreferences = {
  language: SupportedLanguage;
  pageSize: number;
  filters: ListingFiltersState;
  sortCriteria: SortCriterion[];
  propertyLabels: PropertyLabelEntry[];
};

type SaveFiltersPayload = {
  language: SupportedLanguage;
  showClosed: boolean;
  showNew: boolean;
  showFavourite: boolean;
  showRejected: boolean;
  pageSize: number;
  minPublicationDate: string;
  maxPublicationDate: string;
  minPrice: string;
  maxPrice: string;
  sortCriteria: SortCriterion[];
};

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesPayloadMapperService {
  normalizePreferencesPayload(
    response: UserPreferencesPayload | null | undefined
  ): NormalizedUserPreferences {
    return {
      language: this.toSupportedLanguage(response?.language, 'en'),
      pageSize: this.toPageSize(response?.pageSize, 100),
      filters: {
        showClosed: this.toBoolean(response?.showClosed, true),
        showNew: this.toBoolean(response?.showNew, true),
        showFavourite: this.toBoolean(response?.showFavourite, true),
        showRejected: this.toBoolean(response?.showRejected, true),
        minPublicationDate: this.toDateOnlyString(response?.minPublicationDate),
        maxPublicationDate: this.toDateOnlyString(response?.maxPublicationDate),
        minPrice: this.toIntegerString(response?.minPrice),
        maxPrice: this.toIntegerString(response?.maxPrice)
      },
      sortCriteria: this.normalizeSortCriteria(response?.sortCriteria),
      propertyLabels: this.normalizePropertyLabels(response?.propertyLabels)
    };
  }

  buildSaveFiltersPayload(
    filters: ListingFiltersState,
    language: SupportedLanguage,
    sortCriteria: SortCriterion[],
    pageSize: number
  ): SaveFiltersPayload {
    return {
      language,
      showClosed: filters.showClosed,
      showNew: filters.showNew,
      showFavourite: filters.showFavourite,
      showRejected: filters.showRejected,
      pageSize: this.toPageSize(pageSize, 100),
      minPublicationDate: this.toDateOnlyString(filters.minPublicationDate),
      maxPublicationDate: this.toDateOnlyString(filters.maxPublicationDate),
      minPrice: this.toIntegerString(filters.minPrice),
      maxPrice: this.toIntegerString(filters.maxPrice),
      sortCriteria: this.normalizeSortCriteria(sortCriteria)
    };
  }

  toBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
    }
    return fallback;
  }

  toSupportedLanguage(value: unknown, fallback: SupportedLanguage): SupportedLanguage {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'sp') {
        return 'sp';
      }
      if (normalized === 'en') {
        return 'en';
      }
    }

    return fallback;
  }

  toDateOnlyString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = trimmed.match(datePattern);
    if (!match) {
      return '';
    }

    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return '';
    }

    return trimmed;
  }

  toIntegerString(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return String(Math.round(value));
    }

    if (typeof value !== 'string') {
      return '';
    }

    const normalized = value.replace(/[^\d]/g, '').trim();
    if (!normalized) {
      return '';
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return '';
    }

    return String(parsed);
  }

  toPageSize(value: unknown, fallback: number): number {
    const normalizedFallback = DASHBOARD_PAGE_SIZE_OPTIONS.includes(fallback as 100 | 500 | 1000)
      ? fallback
      : DASHBOARD_PAGE_SIZE_OPTIONS[0];

    if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
      const parsed = Math.floor(value);
      return DASHBOARD_PAGE_SIZE_OPTIONS.includes(parsed as 100 | 500 | 1000)
        ? parsed
        : normalizedFallback;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        return DASHBOARD_PAGE_SIZE_OPTIONS.includes(parsed as 100 | 500 | 1000)
          ? parsed
          : normalizedFallback;
      }
    }

    return normalizedFallback;
  }

  normalizePropertyLabels(value: unknown): PropertyLabelEntry[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const entries: PropertyLabelEntry[] = [];
    for (const item of value) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      const propertyId = (item as { propertyId?: unknown }).propertyId;
      const labels = (item as { labels?: unknown }).labels;
      if (typeof propertyId !== 'string' || !propertyId.trim()) {
        continue;
      }
      if (typeof labels !== 'object' || labels === null || Array.isArray(labels)) {
        continue;
      }

      const normalizedLabels = { ...(labels as Record<string, unknown>) };
      if (typeof normalizedLabels['review'] === 'string') {
        const review = (normalizedLabels['review'] as string).trim().toUpperCase();
        if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
          normalizedLabels['review'] = review as PropertyReviewLabel;
        } else {
          delete normalizedLabels['review'];
        }
      }
      if (typeof normalizedLabels['comment'] === 'string') {
        normalizedLabels['comment'] = (normalizedLabels['comment'] as string).trim();
      } else if (typeof normalizedLabels['propertyComments'] === 'string') {
        normalizedLabels['comment'] = (normalizedLabels['propertyComments'] as string).trim();
      } else {
        delete normalizedLabels['comment'];
      }
      delete normalizedLabels['propertyComments'];

      entries.push({
        propertyId: propertyId.trim(),
        labels: normalizedLabels as PropertyLabels
      });
    }

    return entries;
  }

  normalizeSortCriteria(value: unknown): SortCriterion[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const allowedSortFields = new Set<SortField>(['title', 'publicationDate', 'price']);
    const seenSortFields = new Set<SortField>();
    const normalized: SortCriterion[] = [];
    for (const item of value) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      const sortByRaw = (item as { sortBy?: unknown }).sortBy;
      if (typeof sortByRaw !== 'string') {
        continue;
      }

      const sortBy = sortByRaw.trim() as SortField;
      if (!allowedSortFields.has(sortBy) || seenSortFields.has(sortBy)) {
        continue;
      }

      const sortOrderRaw =
        (item as { sortOrder?: unknown; order?: unknown }).sortOrder ??
        (item as { sortOrder?: unknown; order?: unknown }).order;
      const sortOrder = this.toSortDirection(sortOrderRaw, 'asc');
      seenSortFields.add(sortBy);
      normalized.push({
        sortBy,
        sortOrder
      });
    }

    return normalized;
  }

  toSortDirection(value: unknown, fallback: SortDirection): SortDirection {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'asc') {
        return 'asc';
      }
      if (normalized === 'desc') {
        return 'desc';
      }
    }

    return fallback;
  }
}
