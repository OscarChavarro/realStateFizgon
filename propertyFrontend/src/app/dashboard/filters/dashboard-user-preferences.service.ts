import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DashboardFiltersState } from 'src/app/dashboard/filters/dashboard-filters.model';
import { PropertyLabelEntry, PropertyLabels, PropertyReviewLabel } from 'src/app/dashboard/dashboard.types';

type UserPreferencesPayload = {
  showClosed?: unknown;
  propertyLabels?: unknown;
};

@Injectable({
  providedIn: 'root'
})
export class DashboardUserPreferencesService {
  async loadPreferences(
    http: HttpClient,
    backendBaseUrl: string
  ): Promise<{ filters: DashboardFiltersState; propertyLabels: PropertyLabelEntry[] } | null> {
    try {
      const response = await firstValueFrom(
        http.get<UserPreferencesPayload>(`${backendBaseUrl}/auth/preferences`, {
          withCredentials: true
        })
      );
      return {
        filters: {
          showClosed: this.toBoolean(response?.showClosed, true)
        },
        propertyLabels: this.normalizePropertyLabels(response?.propertyLabels)
      };
    } catch {
      return null;
    }
  }

  async saveFilters(http: HttpClient, backendBaseUrl: string, filters: DashboardFiltersState): Promise<void> {
    await firstValueFrom(
      http.post(
        `${backendBaseUrl}/auth/preferences/filters`,
        { showClosed: filters.showClosed },
        { withCredentials: true }
      )
    );
  }

  async setPropertyReview(
    http: HttpClient,
    backendBaseUrl: string,
    propertyId: string,
    review: PropertyReviewLabel
  ): Promise<PropertyLabelEntry[]> {
    return this.setPropertyLabels(http, backendBaseUrl, propertyId, { review });
  }

  async setPropertyComment(
    http: HttpClient,
    backendBaseUrl: string,
    propertyId: string,
    comment: string
  ): Promise<PropertyLabelEntry[]> {
    return this.setPropertyLabels(http, backendBaseUrl, propertyId, { comment });
  }

  private async setPropertyLabels(
    http: HttpClient,
    backendBaseUrl: string,
    propertyId: string,
    labels: Partial<PropertyLabels>
  ): Promise<PropertyLabelEntry[]> {
    const response = await firstValueFrom(
      http.post<UserPreferencesPayload>(
        `${backendBaseUrl}/auth/preferences/setPropertyLabels`,
        {
          propertyId,
          labels
        },
        { withCredentials: true }
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
