import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SessionCoordinatorService } from 'src/app/auth/services/session-coordinator.service';

@Injectable({
  providedIn: 'root'
})
export class UserSessionManagementUseCaseService {
  constructor(private readonly listingSessionCoordinatorService: SessionCoordinatorService) {}

  async logoutCurrentUser(http: HttpClient): Promise<void> {
    await this.listingSessionCoordinatorService.logoutAndReset(http);
  }

  async loadUsers(http: HttpClient): Promise<void> {
    await this.listingSessionCoordinatorService.loadUsers(http);
  }

  async deleteUserAndRefresh(http: HttpClient, userId: string): Promise<void> {
    await this.listingSessionCoordinatorService.deleteUserAndRefresh(http, userId);
  }
}
