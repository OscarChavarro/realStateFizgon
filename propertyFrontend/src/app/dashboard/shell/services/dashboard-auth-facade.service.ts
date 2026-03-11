import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ApiRuntimeConfigService } from 'src/app/api/api-runtime-config.service';
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
    private readonly authUsersService: AuthUsersService,
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService
  ) {}

  async loadGoogleLoginAvailability(http: HttpClient): Promise<boolean> {
    return this.authSessionApiService.loadGoogleLoginAvailability(http);
  }

  buildGoogleLoginUrl(returnTo: string): string {
    return this.authSessionApiService.buildGoogleLoginUrl(returnTo);
  }

  async loadCurrentUser(http: HttpClient): Promise<AuthenticatedUser | null> {
    return this.authSessionApiService.loadCurrentUser(http);
  }

  async logout(http: HttpClient): Promise<void> {
    await this.authSessionApiService.logout(http);
  }

  async loadUsers(http: HttpClient): Promise<AuthUserListItem[]> {
    return this.authUsersService.loadUsers(http);
  }

  async deleteUser(http: HttpClient, userId: string): Promise<boolean> {
    return this.authUsersService.deleteUser(http, userId);
  }

  warnIfAuthHostMismatch(frontendHost: string): void {
    try {
      const backendBaseUrl = this.apiRuntimeConfigService.getBackendBaseUrl();
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
