import { Injectable } from '@angular/core';
import { UserPreferencesService } from 'src/app/prefs/services/user-preferences.service';
import {
  PropertyLabelEntry,
  PropertyLabels,
  PropertyReviewLabel
} from 'src/app/listing/model/listing.types';

@Injectable({
  providedIn: 'root'
})
export class PropertyLabelsFacadeService {
  constructor(private readonly listingUserPreferencesService: UserPreferencesService) {}

  getPropertyReviewLabel(
    propertyLabels: PropertyLabelEntry[],
    propertyId: string
  ): PropertyReviewLabel {
    const entry = propertyLabels.find((item) => item.propertyId === propertyId);
    const review = entry?.labels.review;
    if (review === 'NEW' || review === 'FAVOURITE' || review === 'DISCHARGED') {
      return review;
    }
    return 'NEW';
  }

  getPropertyComment(propertyLabels: PropertyLabelEntry[], propertyId: string): string {
    const entry = propertyLabels.find((item) => item.propertyId === propertyId);
    const comment = entry?.labels.comment;
    if (typeof comment === 'string') {
      return comment;
    }
    return '';
  }

  async togglePropertyReview(
    propertyId: string,
    propertyLabels: PropertyLabelEntry[]
  ): Promise<PropertyLabelEntry[]> {
    const currentReview = this.getPropertyReviewLabel(propertyLabels, propertyId);
    const nextReview = this.nextReviewLabel(currentReview);
    return this.listingUserPreferencesService.setPropertyReview(propertyId, nextReview);
  }

  async savePropertyComment(
    propertyId: string,
    commentRaw: string,
    propertyLabels: PropertyLabelEntry[]
  ): Promise<PropertyLabelEntry[] | null> {
    const comment = commentRaw.trim();
    if (this.getPropertyComment(propertyLabels, propertyId) === comment) {
      return null;
    }

    return this.listingUserPreferencesService.setPropertyComment(propertyId, comment);
  }

  private nextReviewLabel(current: PropertyReviewLabel): PropertyReviewLabel {
    if (current === 'NEW') {
      return 'FAVOURITE';
    }
    if (current === 'FAVOURITE') {
      return 'DISCHARGED';
    }
    return 'NEW';
  }

  mergeLabelEntries(
    current: PropertyLabelEntry[],
    propertyId: string,
    labels: Partial<PropertyLabels>
  ): PropertyLabelEntry[] {
    const index = current.findIndex((entry) => entry.propertyId === propertyId);
    if (index === -1) {
      return [...current, { propertyId, labels: { ...labels } }];
    }

    const updated = [...current];
    updated[index] = {
      propertyId,
      labels: {
        ...updated[index].labels,
        ...labels
      }
    };
    return updated;
  }
}
