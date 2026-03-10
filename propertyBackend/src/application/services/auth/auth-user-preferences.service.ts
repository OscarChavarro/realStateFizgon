import { Injectable } from '@nestjs/common';
import { AuthUserRepository } from 'src/adapters/outbound/persistence/mongodb/auth-user.repository';

export type PropertyReviewLabel = 'NEW' | 'FAVOURITE' | 'DISCHARGED';

export type UserPropertyLabels = {
  propertyId: string;
  labels: Record<string, unknown> & {
    review?: PropertyReviewLabel;
    comment?: string;
  };
};

export type AuthUserPreferences = {
  showClosed: boolean;
  showNew: boolean;
  showFavourite: boolean;
  showRejected: boolean;
  propertyLabels: UserPropertyLabels[];
};

@Injectable()
export class AuthUserPreferencesService {
  constructor(private readonly authUserRepository: AuthUserRepository) {}

  async getPreferences(userId: string): Promise<AuthUserPreferences> {
    const preferences = await this.authUserRepository.getUserPreferences(userId);
    const propertyLabels = this.normalizePropertyLabels(preferences['propertyLabels']);
    return {
      showClosed: this.toBoolean(preferences['showClosed'], true),
      showNew: this.toBoolean(preferences['showNew'], true),
      showFavourite: this.toBoolean(preferences['showFavourite'], true),
      showRejected: this.toBoolean(preferences['showRejected'], true),
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
    }
  ): Promise<AuthUserPreferences> {
    const normalized = {
      showClosed: this.toBoolean(preferences.showClosed, true),
      showNew: this.toBoolean(preferences.showNew, true),
      showFavourite: this.toBoolean(preferences.showFavourite, true),
      showRejected: this.toBoolean(preferences.showRejected, true)
    };

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
