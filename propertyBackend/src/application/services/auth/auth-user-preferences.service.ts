import { Injectable } from '@nestjs/common';
import { AuthUserRepository } from 'src/adapters/outbound/persistence/mongodb/auth-user.repository';

export type PropertyReviewLabel = 'NEW' | 'FAVOURITE' | 'DISCHARGED';
export type PreferredLanguage = 'en' | 'sp';
export type UserPreferencesSortField = 'publicationDate' | 'title' | 'price';
export type UserPreferencesSortOrder = 'asc' | 'desc';

export type UserPreferencesSortCriterion = {
  sortBy: UserPreferencesSortField;
  sortOrder: UserPreferencesSortOrder;
};

export type UserPropertyLabels = {
  propertyId: string;
  labels: Record<string, unknown> & {
    review?: PropertyReviewLabel;
    comment?: string;
  };
};

export type AuthUserPreferences = {
  language: PreferredLanguage;
  showClosed: boolean;
  showNew: boolean;
  showFavourite: boolean;
  showRejected: boolean;
  minPublicationDate: string | null;
  maxPublicationDate: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  sortCriteria: UserPreferencesSortCriterion[];
  propertyLabels: UserPropertyLabels[];
};

@Injectable()
export class AuthUserPreferencesService {
  constructor(private readonly authUserRepository: AuthUserRepository) {}

  async getPreferences(userId: string): Promise<AuthUserPreferences> {
    const preferences = await this.authUserRepository.getUserPreferences(userId);
    const propertyLabels = this.normalizePropertyLabels(preferences['propertyLabels']);
    return {
      language: this.toPreferredLanguage(preferences['language'], 'en'),
      showClosed: this.toBoolean(preferences['showClosed'], true),
      showNew: this.toBoolean(preferences['showNew'], true),
      showFavourite: this.toBoolean(preferences['showFavourite'], true),
      showRejected: this.toBoolean(preferences['showRejected'], true),
      minPublicationDate: this.toDateOnlyString(preferences['minPublicationDate']),
      maxPublicationDate: this.toDateOnlyString(preferences['maxPublicationDate']),
      minPrice: this.toPriceStringOrNull(preferences['minPrice']),
      maxPrice: this.toPriceStringOrNull(preferences['maxPrice']),
      sortCriteria: this.normalizeSortCriteria(preferences['sortCriteria']),
      propertyLabels
    };
  }

  async saveFiltersPreferences(
    userId: string,
    preferences: {
      showClosed: boolean;
      showNew: boolean;
      showFavourite: boolean;
      showRejected: boolean;
      minPublicationDate?: unknown;
      maxPublicationDate?: unknown;
      minPrice?: unknown;
      maxPrice?: unknown;
      language?: unknown;
      sortCriteria?: unknown;
    }
  ): Promise<AuthUserPreferences> {
    const normalized: {
      language: PreferredLanguage;
      showClosed: boolean;
      showNew: boolean;
      showFavourite: boolean;
      showRejected: boolean;
      minPublicationDate: string | null;
      maxPublicationDate: string | null;
      minPrice: string | null;
      maxPrice: string | null;
      sortCriteria?: UserPreferencesSortCriterion[];
    } = {
      language: this.toPreferredLanguage(preferences.language, 'en'),
      showClosed: this.toBoolean(preferences.showClosed, true),
      showNew: this.toBoolean(preferences.showNew, true),
      showFavourite: this.toBoolean(preferences.showFavourite, true),
      showRejected: this.toBoolean(preferences.showRejected, true),
      minPublicationDate: this.toDateOnlyString(preferences.minPublicationDate),
      maxPublicationDate: this.toDateOnlyString(preferences.maxPublicationDate),
      minPrice: this.toPriceStringOrNull(preferences.minPrice),
      maxPrice: this.toPriceStringOrNull(preferences.maxPrice)
    };
    if (preferences.sortCriteria !== undefined) {
      normalized.sortCriteria = this.normalizeSortCriteria(preferences.sortCriteria);
    }

    await this.authUserRepository.mergeUserPreferences(userId, normalized);
    return this.getPreferences(userId);
  }

  async setPropertyLabels(
    userId: string,
    propertyIdRaw: string,
    labelsPatch: Record<string, unknown>
  ): Promise<AuthUserPreferences> {
    const propertyId = propertyIdRaw.trim();
    if (!propertyId) {
      return this.getPreferences(userId);
    }
    if (Object.keys(labelsPatch).length === 0) {
      return this.getPreferences(userId);
    }

    const currentPreferences = await this.getPreferences(userId);
    const currentLabels = [...currentPreferences.propertyLabels];
    const index = currentLabels.findIndex((item) => item.propertyId === propertyId);
    const currentEntry = index >= 0 ? currentLabels[index] : null;
    const mergedLabels = {
      ...(currentEntry?.labels ?? {}),
      ...labelsPatch
    };

    if (index >= 0) {
      currentLabels[index] = {
        propertyId,
        labels: mergedLabels
      };
    } else {
      currentLabels.push({
        propertyId,
        labels: mergedLabels
      });
    }

    await this.authUserRepository.mergeUserPreferences(userId, {
      propertyLabels: currentLabels
    });

    return this.getPreferences(userId);
  }

  private toBoolean(value: unknown, fallback: boolean): boolean {
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

  private toDateOnlyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) {
      return null;
    }

    const parsed = new Date(`${match[1]}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== match[1]) {
      return null;
    }

    return match[1];
  }

  private toPriceStringOrNull(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return String(Math.round(value));
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.replace(/[^\d]/g, '').trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return String(parsed);
  }

  private toPreferredLanguage(value: unknown, fallback: PreferredLanguage): PreferredLanguage {
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

  private normalizeSortCriteria(value: unknown): UserPreferencesSortCriterion[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const allowedSortFields = new Set<UserPreferencesSortField>(['title', 'publicationDate', 'price']);
    const seenSortFields = new Set<UserPreferencesSortField>();
    const normalized: UserPreferencesSortCriterion[] = [];
    for (const item of value) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      const sortByRaw = (item as { sortBy?: unknown }).sortBy;
      if (typeof sortByRaw !== 'string') {
        continue;
      }

      const sortBy = sortByRaw.trim() as UserPreferencesSortField;
      if (!allowedSortFields.has(sortBy) || seenSortFields.has(sortBy)) {
        continue;
      }

      const sortOrderRaw = (item as { sortOrder?: unknown; order?: unknown }).sortOrder
        ?? (item as { sortOrder?: unknown; order?: unknown }).order;
      const sortOrder = this.toSortOrder(sortOrderRaw, 'asc');
      seenSortFields.add(sortBy);
      normalized.push({
        sortBy,
        sortOrder
      });
    }

    return normalized;
  }

  private toSortOrder(value: unknown, fallback: UserPreferencesSortOrder): UserPreferencesSortOrder {
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

  private normalizePropertyLabels(value: unknown): UserPropertyLabels[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const entries: UserPropertyLabels[] = [];
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

      entries.push({
        propertyId: propertyId.trim(),
        labels: this.normalizeLabelsObject(labels as Record<string, unknown>)
      });
    }

    return entries;
  }

  private normalizeLabelsObject(labels: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...labels };

    const reviewRaw = normalized['review'];
    if (typeof reviewRaw === 'string') {
      const review = reviewRaw.trim().toUpperCase();
      if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
        normalized['review'] = review as PropertyReviewLabel;
      } else {
        delete normalized['review'];
      }
    }

    const commentRaw = normalized['comment'];
    const legacyCommentRaw = normalized['propertyComments'];
    if (typeof commentRaw === 'string') {
      normalized['comment'] = commentRaw.trim();
    } else if (typeof legacyCommentRaw === 'string') {
      normalized['comment'] = legacyCommentRaw.trim();
    } else {
      delete normalized['comment'];
    }

    delete normalized['propertyComments'];
    return normalized;
  }
}
