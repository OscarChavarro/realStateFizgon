import { Injectable } from '@angular/core';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { AuthSessionApiService } from 'src/app/auth/services/auth-session-api.service';
import { AuthUserListItem } from 'src/app/auth/model/auth-user-list-item.model';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { AuthUsersService } from 'src/app/auth/services/auth-users.service';
import { RequestErrorPolicyService } from 'src/app/core/errors/services/request-error-policy.service';

@Injectable({
  providedIn: 'root'
})
export class AuthFacadeService {
  constructor(
    private readonly authSessionApiService: AuthSessionApiService,
    private readonly authUsersService: AuthUsersService,
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService,
    private readonly requestErrorPolicyService: RequestErrorPolicyService
  ) {}

  async loadGoogleLoginAvailability(): Promise<boolean> {
    return this.authSessionApiService.loadGoogleLoginAvailability();
  }

  buildGoogleLoginUrl(returnTo: string): string {
    return this.authSessionApiService.buildGoogleLoginUrl(returnTo);
  }

  async loadCurrentUser(): Promise<AuthenticatedUser | null> {
    return this.authSessionApiService.loadCurrentUser();
  }

  async logout(): Promise<void> {
    await this.authSessionApiService.logout();
  }

  async loadUsers(): Promise<AuthUserListItem[]> {
    return this.authUsersService.loadUsers();
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.authUsersService.deleteUser(userId);
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
    } catch (error) {
      this.requestErrorPolicyService.notifyFallback(
        'auth.warnIfAuthHostMismatch',
        this.requestErrorPolicyService.classify(error)
      );
    }
  }
}
