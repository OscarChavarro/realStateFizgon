import { Injectable } from '@angular/core';
import { ListingPropertyRow, ListingTab } from 'src/app/listing/model/listing.types';
import { PropertyRowScroller } from 'src/app/listing/services/interaction-shortcuts.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';

type KeyboardFlowParams = {
  event: KeyboardEvent;
  activeTab: ListingTab;
  isAuthenticated: boolean;
  properties: ListingPropertyRow[];
  selectedProperty: ListingPropertyRow | null;
  onTogglePropertyReview: (property: ListingPropertyRow) => void;
  scroller?: PropertyRowScroller;
};

@Injectable({
  providedIn: 'root'
})
export class KeyboardFlowUseCaseService {
  constructor(
    private readonly workspaceInteractionCoordinatorService: WorkspaceInteractionCoordinatorService
  ) {}

  handleWindowKeyDown(params: KeyboardFlowParams): void {
    this.workspaceInteractionCoordinatorService.handleWindowKeyDown(params);
  }
}
