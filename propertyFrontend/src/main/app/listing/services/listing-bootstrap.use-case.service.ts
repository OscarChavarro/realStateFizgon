import { Injectable } from '@angular/core';
import { WorkspaceInteractionCoordinatorService } from 'src/app/listing/services/workspace-interaction-coordinator.service';

type ListingBootstrapParams = {
  onRefreshListingData: () => Promise<void>;
};

@Injectable({
  providedIn: 'root'
})
export class ListingBootstrapUseCaseService {
  constructor(
    private readonly workspaceInteractionCoordinatorService: WorkspaceInteractionCoordinatorService
  ) {}

  async initialize(params: ListingBootstrapParams): Promise<void> {
    await params.onRefreshListingData();
    this.workspaceInteractionCoordinatorService.connectUpdatesSocket(async () => params.onRefreshListingData());
  }

  teardown(): void {
    this.workspaceInteractionCoordinatorService.disconnectUpdatesSocket();
  }
}
