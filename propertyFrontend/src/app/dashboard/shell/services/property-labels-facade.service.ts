import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DashboardUserPreferencesService } from 'src/app/dashboard/filters/dashboard-user-preferences.service';
import { PropertyLabelEntry, PropertyLabels, PropertyReviewLabel } from 'src/app/dashboard/dashboard.types';

@Injectable({
  providedIn: 'root'
})
export class PropertyLabelsFacadeService {
  constructor(
    private readonly dashboardUserPreferencesService: DashboardUserPreferencesService
  ) {}

  getPropertyReviewLabel(propertyLabels: PropertyLabelEntry[], propertyId: string): PropertyReviewLabel {
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
    http: HttpClient,
    backendBaseUrl: string,
    propertyId: string,
    propertyLabels: PropertyLabelEntry[]
  ): Promise<PropertyLabelEntry[]> {
    const currentReview = this.getPropertyReviewLabel(propertyLabels, propertyId);
    const nextReview = this.nextReviewLabel(currentReview);
    return this.dashboardUserPreferencesService.setPropertyReview(http, backendBaseUrl, propertyId, nextReview);
  }

  async savePropertyComment(
    http: HttpClient,
    backendBaseUrl: string,
    propertyId: string,
    commentRaw: string,
    propertyLabels: PropertyLabelEntry[]
  ): Promise<PropertyLabelEntry[] | null> {
    const comment = commentRaw.trim();
    if (this.getPropertyComment(propertyLabels, propertyId) === comment) {
      return null;
    }

    return this.dashboardUserPreferencesService.setPropertyComment(http, backendBaseUrl, propertyId, comment);
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
