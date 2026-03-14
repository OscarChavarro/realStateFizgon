import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DashboardFiltersState } from 'src/app/dashboard/filters/dashboard-filters.model';
import { PropertyLabelEntry, PropertyLabels, PropertyReviewLabel } from 'src/app/dashboard/dashboard.types';

type UserPreferencesPayload = {
  showClosed?: unknown;
  showNew?: unknown;
  showFavourite?: unknown;
  showRejected?: unknown;
  minPublicationDate?: unknown;
  maxPublicationDate?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  propertyLabels?: unknown;
};

@Injectable({
  providedIn: 'root'
})
export class DashboardUserPreferencesService {
  async loadPreferences(
    http: HttpClient
  ): Promise<{ filters: DashboardFiltersState; propertyLabels: PropertyLabelEntry[] } | null> {
    try {
      const response = await firstValueFrom(
        http.get<UserPreferencesPayload>('/auth/preferences')
      );
      return {
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
        propertyLabels: this.normalizePropertyLabels(response?.propertyLabels)
      };
    } catch {
      return null;
    }
  }

  async saveFilters(http: HttpClient, filters: DashboardFiltersState): Promise<void> {
    await firstValueFrom(
      http.post(
        '/auth/preferences/filters',
        {
          showClosed: filters.showClosed,
          showNew: filters.showNew,
          showFavourite: filters.showFavourite,
          showRejected: filters.showRejected,
          minPublicationDate: this.toDateOnlyString(filters.minPublicationDate),
          maxPublicationDate: this.toDateOnlyString(filters.maxPublicationDate),
          minPrice: this.toIntegerString(filters.minPrice),
          maxPrice: this.toIntegerString(filters.maxPrice)
        }
      )
    );
  }

  async setPropertyReview(
    http: HttpClient,
    propertyId: string,
    review: PropertyReviewLabel
  ): Promise<PropertyLabelEntry[]> {
    return this.setPropertyLabels(http, propertyId, { review });
  }

  async setPropertyComment(
    http: HttpClient,
    propertyId: string,
    comment: string
  ): Promise<PropertyLabelEntry[]> {
    return this.setPropertyLabels(http, propertyId, { comment });
  }

  private async setPropertyLabels(
    http: HttpClient,
    propertyId: string,
    labels: Partial<PropertyLabels>
  ): Promise<PropertyLabelEntry[]> {
    const response = await firstValueFrom(
      http.post<UserPreferencesPayload>(
        '/auth/preferences/setPropertyLabels',
        {
          propertyId,
          labels
        }
      )
    );

    return this.normalizePropertyLabels(response.propertyLabels);
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

  private toDateOnlyString(value: unknown): string {
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
    if (Number.isNaN(parsed.getTime())
      || parsed.getUTCFullYear() !== year
      || parsed.getUTCMonth() !== month - 1
      || parsed.getUTCDate() !== day) {
      return '';
    }

    return trimmed;
  }

  private toIntegerString(value: unknown): string {
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

  private normalizePropertyLabels(value: unknown): PropertyLabelEntry[] {
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
        labels: normalizedLabels
      });
    }

    return entries;
  }
}
