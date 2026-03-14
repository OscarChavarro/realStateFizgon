import { Injectable } from '@angular/core';
import { DashboardPropertyRow, DashboardTab } from 'src/app/dashboard/dashboard.types';
import { PropertyRowScroller } from 'src/app/dashboard/shell/services/interaction-shortcuts.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/dashboard/shell/services/workspace-interaction-coordinator.service';

type KeyboardFlowParams = {
  event: KeyboardEvent;
  activeTab: DashboardTab;
  isAuthenticated: boolean;
  properties: DashboardPropertyRow[];
  selectedProperty: DashboardPropertyRow | null;
  onTogglePropertyReview: (property: DashboardPropertyRow) => void;
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
