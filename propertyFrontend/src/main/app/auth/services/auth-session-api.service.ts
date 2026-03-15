import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiRuntimeConfigService } from 'src/app/core/api/services/api-runtime-config.service';
import { AuthenticatedUser } from 'src/app/auth/model/authenticated-user.model';

type CurrentUserResponse = {
  authenticated?: boolean;
  user?: AuthenticatedUser | null;
};

@Injectable({
  providedIn: 'root'
})
export class AuthSessionApiService {
  constructor(
    private readonly apiRuntimeConfigService: ApiRuntimeConfigService
  ) {}

  async loadGoogleLoginAvailability(http: HttpClient): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        http.get<{ enabled?: boolean }>('/auth/google/login-url')
      );
      return response.enabled === true;
    } catch {
      return false;
    }
  }

  async loadCurrentUser(http: HttpClient): Promise<AuthenticatedUser | null> {
    try {
      const response = await firstValueFrom(
        http.get<CurrentUserResponse>('/auth/google/me')
      );

      if (response.authenticated && response.user) {
        return response.user;
      }

      return null;
    } catch {
      return null;
    }
  }

  async logout(http: HttpClient): Promise<void> {
    try {
      await firstValueFrom(
        http.post('/auth/google/logout', {})
      );
    } catch {
      // Ignore; caller will clear local state anyway.
    }
  }

  buildGoogleLoginUrl(returnTo: string): string {
    const loginUrl = new URL('/auth/google/login', `${this.apiRuntimeConfigService.getBackendBaseUrl()}/`);
    loginUrl.searchParams.set('returnTo', returnTo);
    return loginUrl.toString();
  }
}
