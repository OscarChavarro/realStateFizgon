import { Injectable } from '@angular/core';
import { WorkspaceInteractionCoordinatorService } from 'src/app/dashboard/shell/services/workspace-interaction-coordinator.service';

type DashboardBootstrapParams = {
  onRefreshDashboardData: () => Promise<void>;
};

@Injectable({
  providedIn: 'root'
})
export class DashboardBootstrapUseCaseService {
  constructor(
    private readonly workspaceInteractionCoordinatorService: WorkspaceInteractionCoordinatorService
  ) {}

  async initialize(params: DashboardBootstrapParams): Promise<void> {
    await params.onRefreshDashboardData();
    this.workspaceInteractionCoordinatorService.connectUpdatesSocket(async () => params.onRefreshDashboardData());
  }

  teardown(): void {
    this.workspaceInteractionCoordinatorService.disconnectUpdatesSocket();
  }
}
