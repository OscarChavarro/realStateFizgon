import { ElementRef, Injectable } from '@angular/core';
import { ListingPropertyRow, ListingTab } from 'src/app/listing/model/listing.types';
import { KeyboardFlowUseCaseService } from 'src/app/listing/services/keyboard-flow.use-case.service';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';

type ShellKeyboardInteractionParams = {
  event: KeyboardEvent;
  activeTab: ListingTab;
  isAuthenticated: boolean;
  properties: ListingPropertyRow[];
  selectedProperty: ListingPropertyRow | null;
  onTogglePropertyReview: (property: ListingPropertyRow) => void;
  onTogglePropertyLocationDialog: () => void;
  scroller?: {
    scrollPropertyIntoView(property: ListingPropertyRow): void;
  };
};

@Injectable({
  providedIn: 'root'
})
export class ShellInputInteractionUseCaseService {
  constructor(
    private readonly workspaceInteractionCoordinatorService: WorkspaceInteractionCoordinatorService,
    private readonly keyboardFlowUseCaseService: KeyboardFlowUseCaseService
  ) {}

  onSplitterMouseDown(event: MouseEvent): void {
    this.workspaceInteractionCoordinatorService.startResize(event);
  }

  onWindowMouseMove(event: MouseEvent, workspaceContainer?: ElementRef<HTMLDivElement>): void {
    this.workspaceInteractionCoordinatorService.handleWindowMouseMove(
      event,
      workspaceContainer?.nativeElement ?? null
    );
  }

  onWindowMouseUp(): void {
    this.workspaceInteractionCoordinatorService.handleWindowMouseUp();
  }

  onWindowKeyDown(params: ShellKeyboardInteractionParams): void {
    this.keyboardFlowUseCaseService.handleWindowKeyDown(params);
  }
}
