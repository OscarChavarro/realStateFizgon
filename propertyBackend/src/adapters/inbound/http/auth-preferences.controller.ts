import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';
import {
  AuthUserPreferences,
  AuthUserPreferencesService,
  PreferredLanguage,
  PropertyReviewLabel,
  UserPreferencesSortCriterion
} from 'src/application/services/auth/auth-user-preferences.service';

type HttpRequestLike = {
  headers?: {
    cookie?: string;
  };
};

type SaveFiltersPreferencesBody = {
  language?: unknown;
  showClosed?: unknown;
  showNew?: unknown;
  showFavourite?: unknown;
  showRejected?: unknown;
  pageSize?: unknown;
  minPublicationDate?: unknown;
  maxPublicationDate?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  sortCriteria?: unknown;
};

type SetPropertyLabelsBody = {
  propertyId?: unknown;
  labels?: unknown;
};

@Controller('auth/preferences')
export class AuthPreferencesController {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly authUserPreferencesService: AuthUserPreferencesService
  ) {}

  @Get()
  async getPreferences(@Req() request: HttpRequestLike): Promise<AuthUserPreferences> {
    const userId = this.getOptionalUserId(request);
    if (!userId) {
      return {
        language: 'en',
        showClosed: true,
        showNew: true,
        showFavourite: true,
        showRejected: true,
        pageSize: 100,
        minPublicationDate: null,
        maxPublicationDate: null,
        minPrice: null,
        maxPrice: null,
        sortCriteria: [],
        propertyLabels: []
      };
    }

    return this.authUserPreferencesService.getPreferences(userId);
  }

  @Post()
  async saveFiltersPreferences(
    @Req() request: HttpRequestLike,
    @Body() body: SaveFiltersPreferencesBody
  ): Promise<{
    language: PreferredLanguage;
    showClosed: boolean;
    showNew: boolean;
    showFavourite: boolean;
    showRejected: boolean;
    pageSize: number;
    minPublicationDate: string | null;
    maxPublicationDate: string | null;
    minPrice: string | null;
    maxPrice: string | null;
    sortCriteria: UserPreferencesSortCriterion[];
  }> {
    const userId = this.getOptionalUserId(request);
    const showClosed = this.toBoolean(body?.showClosed, true);
    const showNew = this.toBoolean(body?.showNew, true);
    const showFavourite = this.toBoolean(body?.showFavourite, true);
    const showRejected = this.toBoolean(body?.showRejected, true);
    const pageSize = this.toPageSize(body?.pageSize, 100);
    const language = this.toPreferredLanguage(body?.language, 'en');
    const minPublicationDate = this.toDateOnlyString(body?.minPublicationDate);
    const maxPublicationDate = this.toDateOnlyString(body?.maxPublicationDate);
    const minPrice = this.toPriceStringOrNull(body?.minPrice);
    const maxPrice = this.toPriceStringOrNull(body?.maxPrice);
    const sortCriteria = this.normalizeSortCriteria(body?.sortCriteria);
    if (!userId) {
      return {
        language,
        showClosed,
        showNew,
        showFavourite,
        showRejected,
        pageSize,
        minPublicationDate,
        maxPublicationDate,
        minPrice,
        maxPrice,
        sortCriteria
      };
    }

    const preferences = await this.authUserPreferencesService.saveFiltersPreferences(userId, {
      showClosed,
      showNew,
      showFavourite,
      showRejected,
      pageSize,
      language,
      minPublicationDate,
      maxPublicationDate,
      minPrice,
      maxPrice,
      sortCriteria: body?.sortCriteria
    });
    return {
      language: preferences.language,
      showClosed: preferences.showClosed,
      showNew: preferences.showNew,
      showFavourite: preferences.showFavourite,
      showRejected: preferences.showRejected,
      pageSize: preferences.pageSize,
      minPublicationDate: preferences.minPublicationDate,
      maxPublicationDate: preferences.maxPublicationDate,
      minPrice: preferences.minPrice,
      maxPrice: preferences.maxPrice,
      sortCriteria: preferences.sortCriteria
    };
  }

  @Post('setPropertyLabels')
  async setPropertyLabels(
    @Req() request: HttpRequestLike,
    @Body() body: SetPropertyLabelsBody
  ): Promise<AuthUserPreferences> {
    const userId = this.getOptionalUserId(request);
    const propertyId = this.toTrimmedString(body?.propertyId);
    const labels = this.normalizeLabels(body?.labels);
    if (!userId) {
      if (!propertyId || Object.keys(labels).length === 0) {
        return {
          language: 'en',
          showClosed: true,
          showNew: true,
          showFavourite: true,
          showRejected: true,
          pageSize: 100,
          minPublicationDate: null,
          maxPublicationDate: null,
          minPrice: null,
          maxPrice: null,
          sortCriteria: [],
          propertyLabels: []
        };
      }

      return {
        language: 'en',
        showClosed: true,
        showNew: true,
        showFavourite: true,
        showRejected: true,
        pageSize: 100,
        minPublicationDate: null,
        maxPublicationDate: null,
        minPrice: null,
        maxPrice: null,
        sortCriteria: [],
        propertyLabels: [
          {
            propertyId,
            labels
          }
        ]
      };
    }

    return this.authUserPreferencesService.setPropertyLabels(userId, propertyId, labels);
  }

  private getOptionalUserId(request: HttpRequestLike): string | null {
    const user = this.authSessionService.findUserByCookieHeader(request?.headers?.cookie);
    if (!user) {
      return null;
    }

    return user.id;
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

    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
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

  private toPageSize(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
      return Math.floor(value);
    }

    if (typeof value === 'string') {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        return parsed;
      }
    }

    return fallback;
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

  private toTrimmedString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  private normalizeLabels(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    const labels = { ...(value as Record<string, unknown>) };
    const reviewRaw = labels['review'];
    if (typeof reviewRaw === 'string') {
      const normalized = reviewRaw.trim().toUpperCase() as PropertyReviewLabel;
      if (normalized === 'NEW' || normalized === 'FAVOURITE' || normalized === 'DISCHARGED') {
        labels['review'] = normalized;
      } else {
        delete labels['review'];
      }
    }

    const commentRaw = labels['comment'];
    const legacyCommentRaw = labels['propertyComments'];
    if (commentRaw !== undefined) {
      if (typeof commentRaw === 'string') {
        labels['comment'] = commentRaw.trim();
      } else {
        delete labels['comment'];
      }
    } else if (legacyCommentRaw !== undefined) {
      if (typeof legacyCommentRaw === 'string') {
        labels['comment'] = legacyCommentRaw.trim();
      } else {
        delete labels['comment'];
      }
    }

    delete labels['propertyComments'];

    return labels;
  }

  private normalizeSortCriteria(value: unknown): UserPreferencesSortCriterion[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const allowedSortFields = new Set<UserPreferencesSortCriterion['sortBy']>([
      'title',
      'publicationDate',
      'price'
    ]);
    const seenSortFields = new Set<UserPreferencesSortCriterion['sortBy']>();
    const normalized: UserPreferencesSortCriterion[] = [];
    for (const item of value) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      const sortByRaw = (item as { sortBy?: unknown }).sortBy;
      if (typeof sortByRaw !== 'string') {
        continue;
      }

      const sortBy = sortByRaw.trim() as UserPreferencesSortCriterion['sortBy'];
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

  private toSortOrder(value: unknown, fallback: UserPreferencesSortCriterion['sortOrder']): UserPreferencesSortCriterion['sortOrder'] {
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
