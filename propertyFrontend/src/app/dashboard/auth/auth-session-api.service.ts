import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthenticatedUser } from 'src/app/dashboard/auth/authenticated-user.model';

type CurrentUserResponse = {
  authenticated?: boolean;
  user?: AuthenticatedUser | null;
};

@Injectable({
  providedIn: 'root'
})
export class AuthSessionApiService {
  async loadGoogleLoginAvailability(http: HttpClient, backendBaseUrl: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        http.get<{ enabled?: boolean }>(`${backendBaseUrl}/auth/google/login-url`)
      );
      return response.enabled === true;
    } catch {
      return false;
    }
  }

  async loadCurrentUser(http: HttpClient, backendBaseUrl: string): Promise<AuthenticatedUser | null> {
    try {
      const response = await firstValueFrom(
        http.get<CurrentUserResponse>(
          `${backendBaseUrl}/auth/google/me`,
          { withCredentials: true }
        )
      );

      if (response.authenticated && response.user) {
        return response.user;
      }

      return null;
    } catch {
      return null;
    }
  }

  async logout(http: HttpClient, backendBaseUrl: string): Promise<void> {
    try {
      await firstValueFrom(
        http.post(
          `${backendBaseUrl}/auth/google/logout`,
          {},
          { withCredentials: true }
        )
      );
    } catch {
      // Ignore; caller will clear local state anyway.
    }
  }

  buildGoogleLoginUrl(backendBaseUrl: string, returnTo: string): string {
    const loginUrl = new URL('/auth/google/login', `${backendBaseUrl}/`);
    loginUrl.searchParams.set('returnTo', returnTo);
    return loginUrl.toString();
  }
}
