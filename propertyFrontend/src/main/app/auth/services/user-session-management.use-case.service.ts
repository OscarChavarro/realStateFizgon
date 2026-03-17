import { Injectable } from '@angular/core';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';

@Injectable({
  providedIn: 'root'
})
export class UserSessionManagementUseCaseService {
  constructor(private readonly listingSessionCoordinatorService: SessionCoordinatorService) {}

  async logoutCurrentUser(): Promise<void> {
    await this.listingSessionCoordinatorService.logoutAndReset();
  }

  async loadUsers(): Promise<void> {
    await this.listingSessionCoordinatorService.loadUsers();
  }

  async deleteUserAndRefresh(userId: string): Promise<void> {
    await this.listingSessionCoordinatorService.deleteUserAndRefresh(userId);
  }
}
