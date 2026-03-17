import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';
import { RequestErrorPolicyService } from 'src/app/core/errors/services/request-error-policy.service';

type CurrentUserResponse = {
  authenticated?: boolean;
  user?: AuthenticatedUser | null;
};

@Injectable({
  providedIn: 'root'
})
export class AuthSessionApiService {
  constructor(
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService,
    private readonly requestErrorPolicyService: RequestErrorPolicyService
  ) {}

  async loadGoogleLoginAvailability(http: HttpClient): Promise<boolean> {
    return this.requestErrorPolicyService.executeWithFallback({
      operation: 'auth.loadGoogleLoginAvailability',
      request: async () => {
        const response = await firstValueFrom(
          http.get<{ enabled?: boolean }>('/auth/google/login-url')
        );
        return response.enabled === true;
      },
      fallback: () => false
    });
  }

  async loadCurrentUser(http: HttpClient): Promise<AuthenticatedUser | null> {
    return this.requestErrorPolicyService.executeWithFallback({
      operation: 'auth.loadCurrentUser',
      request: async () => {
        const response = await firstValueFrom(http.get<CurrentUserResponse>('/auth/google/me'));

        if (response.authenticated && response.user) {
          return response.user;
        }

        return null;
      },
      fallback: () => null,
      shouldNotifyOnFailure: (classification) => classification.category !== 'unauthorized'
    });
  }

  async logout(http: HttpClient): Promise<void> {
    await this.requestErrorPolicyService.executeWithFallback({
      operation: 'auth.logout',
      request: async () => {
        await firstValueFrom(http.post('/auth/google/logout', {}));
      },
      fallback: () => undefined
    });
  }

  buildGoogleLoginUrl(returnTo: string): string {
    const loginUrl = new URL(
      '/auth/google/login',
      `${this.apiRuntimeConfigService.getBackendBaseUrl()}/`
    );
    loginUrl.searchParams.set('returnTo', returnTo);
    return loginUrl.toString();
  }
}
