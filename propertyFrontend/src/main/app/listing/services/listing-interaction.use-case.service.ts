import { Injectable } from '@angular/core';
import { PropertyLabelEntry } from 'src/app/listing/model/listing.types';
import { RequestErrorPolicyService } from 'src/app/core/errors/services/request-error-policy.service';
import { PropertyLabelsFacadeService } from 'src/app/prefs/services/property-labels-facade.service';

type TogglePropertyReviewParams = {
  propertyId: string;
  isAuthenticated: boolean;
  getPropertyLabels: () => PropertyLabelEntry[];
  setPropertyLabels: (labels: PropertyLabelEntry[]) => void;
};

type SavePropertyCommentParams = {
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
  constructor(
    private readonly propertyLabelsFacadeService: PropertyLabelsFacadeService,
    private readonly requestErrorPolicyService: RequestErrorPolicyService
  ) {}

  async togglePropertyReview(params: TogglePropertyReviewParams): Promise<void> {
    if (!params.isAuthenticated) {
      return;
    }

    try {
      const updatedLabels = await this.propertyLabelsFacadeService.togglePropertyReview(
        params.propertyId,
        params.getPropertyLabels()
      );
      params.setPropertyLabels(updatedLabels);
    } catch (error) {
      this.requestErrorPolicyService.notifyFallback(
        'listing.togglePropertyReview',
        this.requestErrorPolicyService.classify(error)
      );
    }
  }

  async savePropertyComment(params: SavePropertyCommentParams): Promise<void> {
    if (!params.isAuthenticated) {
      return;
    }

    try {
      const updatedLabels = await this.propertyLabelsFacadeService.savePropertyComment(
        params.propertyId,
        params.commentRaw,
        params.getPropertyLabels()
      );
      if (updatedLabels) {
        params.setPropertyLabels(updatedLabels);
      }
    } catch (error) {
      this.requestErrorPolicyService.notifyFallback(
        'listing.savePropertyComment',
        this.requestErrorPolicyService.classify(error)
      );
    }
  }
}
