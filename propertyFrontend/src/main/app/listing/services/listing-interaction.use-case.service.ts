import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PropertyLabelEntry } from 'src/app/listing/model/listing.types';
import { PropertyLabelsFacadeService } from 'src/app/prefs/services/property-labels-facade.service';

type TogglePropertyReviewParams = {
  http: HttpClient;
  propertyId: string;
  isAuthenticated: boolean;
  getPropertyLabels: () => PropertyLabelEntry[];
  setPropertyLabels: (labels: PropertyLabelEntry[]) => void;
};

type SavePropertyCommentParams = {
  http: HttpClient;
  propertyId: string;
  commentRaw: string;
  isAuthenticated: boolean;
  getPropertyLabels: () => PropertyLabelEntry[];
  setPropertyLabels: (labels: PropertyLabelEntry[]) => void;
};

@Injectable({
  providedIn: 'root'
})
export class ListingInteractionUseCaseService {
  constructor(private readonly propertyLabelsFacadeService: PropertyLabelsFacadeService) {}

  async togglePropertyReview(params: TogglePropertyReviewParams): Promise<void> {
    if (!params.isAuthenticated) {
      return;
    }

    try {
      const updatedLabels = await this.propertyLabelsFacadeService.togglePropertyReview(
        params.http,
        params.propertyId,
        params.getPropertyLabels()
      );
      params.setPropertyLabels(updatedLabels);
    } catch {
      // Ignore API errors; UI state remains unchanged.
    }
  }

  async savePropertyComment(params: SavePropertyCommentParams): Promise<void> {
    if (!params.isAuthenticated) {
      return;
    }

    try {
      const updatedLabels = await this.propertyLabelsFacadeService.savePropertyComment(
        params.http,
        params.propertyId,
        params.commentRaw,
        params.getPropertyLabels()
      );
      if (updatedLabels) {
        params.setPropertyLabels(updatedLabels);
      }
    } catch {
      // Ignore API errors; UI state remains unchanged.
    }
  }
}
