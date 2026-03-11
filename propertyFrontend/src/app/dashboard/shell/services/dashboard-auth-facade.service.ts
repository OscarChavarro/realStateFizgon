import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthSessionApiService } from 'src/app/dashboard/auth/auth-session-api.service';
import { AuthUserListItem } from 'src/app/dashboard/auth/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';
import { AuthUsersService } from 'src/app/dashboard/auth/auth-users.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardAuthFacadeService {
  constructor(
    private readonly authSessionApiService: AuthSessionApiService,
    private readonly authUsersService: AuthUsersService
  ) {}

  async loadGoogleLoginAvailability(http: HttpClient, backendBaseUrl: string): Promise<boolean> {
    return this.authSessionApiService.loadGoogleLoginAvailability(http, backendBaseUrl);
  }

  buildGoogleLoginUrl(backendBaseUrl: string, returnTo: string): string {
    return this.authSessionApiService.buildGoogleLoginUrl(backendBaseUrl, returnTo);
  }

  async loadCurrentUser(http: HttpClient, backendBaseUrl: string): Promise<AuthenticatedUser | null> {
    return this.authSessionApiService.loadCurrentUser(http, backendBaseUrl);
  }

  async logout(http: HttpClient, backendBaseUrl: string): Promise<void> {
    await this.authSessionApiService.logout(http, backendBaseUrl);
  }

  async loadUsers(http: HttpClient, backendBaseUrl: string): Promise<AuthUserListItem[]> {
    return this.authUsersService.loadUsers(http, backendBaseUrl);
  }

  async deleteUser(http: HttpClient, backendBaseUrl: string, userId: string): Promise<boolean> {
    return this.authUsersService.deleteUser(http, backendBaseUrl, userId);
  }

  warnIfAuthHostMismatch(backendBaseUrl: string, frontendHost: string): void {
    try {
      const backendHost = new URL(backendBaseUrl).hostname;
      if (backendHost !== frontendHost) {
        console.warn(
          `Auth host mismatch detected (frontend=${frontendHost}, backend=${backendHost}). ` +
          'Prefer the same hostname in frontend URL, backend.baseUrl and auth.google.redirectUri.'
        );
      }
    } catch {
      // Ignore URL parsing issues; normal request errors will surface elsewhere.
    }
  }
}
