import { Injectable } from '@nestjs/common';
import { GoogleIdentityProfile } from 'src/adapters/outbound/persistence/mongodb/auth-user.repository';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';
import { AuthUserIdentityService } from 'src/application/services/auth/auth-user-identity.service';
import { GoogleOAuthCallbackCompletion } from 'src/application/services/auth/google/google-oauth-callback-completion.type';
import { Configuration } from 'src/infrastructure/config/configuration';
import { GoogleOAuthBootstrapResult } from 'src/application/services/auth/google/google-oauth-bootstrap-result.type';

type GoogleOAuthStatePayload = {
  returnTo?: string;
  issuedAt: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class GoogleOAuthBootstrapService {
  constructor(
    private readonly configuration: Configuration,
    private readonly authSessionService: AuthSessionService,
    private readonly authUserIdentityService: AuthUserIdentityService
  ) {}

  buildLoginBootstrap(returnTo?: string): GoogleOAuthBootstrapResult {
    const missingConfigFields = this.getMissingConfigFields();
    if (missingConfigFields.length > 0) {
      return {
        enabled: false,
        authorizationUrl: null,
        message: 'Google OAuth bootstrap is not configured yet.',
        missingConfigFields
      };
    }

    return {
      enabled: true,
      authorizationUrl: this.buildGoogleAuthorizationUrl(returnTo),
      message: 'Google OAuth bootstrap URL generated.',
      missingConfigFields: []
    };
  }

  async completeCallback(params: {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  }): Promise<GoogleOAuthCallbackCompletion> {
    const parsedState = this.decodeState(params.state);
    const redirectTo = this.resolveReturnTo(parsedState.returnTo);

    if (params.error) {
      const description = (params.errorDescription ?? '').trim();
      return {
        success: false,
        redirectTo,
        error: description
          ? `Google OAuth callback returned "${params.error}": ${description}`
          : `Google OAuth callback returned "${params.error}".`
      };
    }

    if (!params.code || params.code.trim().length === 0) {
      return {
        success: false,
        redirectTo,
        error: 'Missing OAuth authorization code in callback.'
      };
    }

    const missingConfigFields = this.getMissingConfigFields();
    if (missingConfigFields.length > 0) {
      return {
        success: false,
        redirectTo,
        error: `Google OAuth bootstrap is not configured yet. Missing: ${missingConfigFields.join(', ')}`
      };
    }

    const tokenExchange = await this.exchangeCodeForTokens(params.code.trim());
    if (!tokenExchange.success || !tokenExchange.accessToken) {
      return {
        success: false,
        redirectTo,
        error: tokenExchange.error ?? 'Google token exchange failed.'
      };
    }

    const profile = await this.loadGoogleUserProfile(tokenExchange.accessToken);
    if (!profile) {
      return {
        success: false,
        redirectTo,
        error: 'Failed loading Google user profile from token.'
      };
    }

    const user = await this.authUserIdentityService.registerGoogleIdentityLogin(profile);
    const session = this.authSessionService.createSession(user);
    return {
      success: true,
      redirectTo,
      sessionId: session.id,
      user
    };
  }

  private getMissingConfigFields(): string[] {
    const missing: string[] = [];
    if (!this.configuration.googleClientId) {
      missing.push('auth.google.clientId');
    }
    if (!this.configuration.googleClientSecret) {
      missing.push('auth.google.clientSecret');
    }
    if (!this.configuration.googleRedirectUri) {
      missing.push('auth.google.redirectUri');
    }
    return missing;
  }

  private buildGoogleAuthorizationUrl(returnTo?: string): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.configuration.googleClientId);
    url.searchParams.set('redirect_uri', this.configuration.googleRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.configuration.googleScope);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', this.configuration.googlePrompt);
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', this.encodeState({ returnTo, issuedAt: new Date().toISOString() }));
    return url.toString();
  }

  private encodeState(payload: GoogleOAuthStatePayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeState(stateRaw: string | undefined): { returnTo: string | null; issuedAt: string | null } {
    if (!stateRaw || stateRaw.trim().length === 0) {
      return { returnTo: null, issuedAt: null };
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(stateRaw, 'base64url').toString('utf8')
      ) as Partial<GoogleOAuthStatePayload>;

      return {
        returnTo: typeof parsed.returnTo === 'string' && parsed.returnTo.trim().length > 0
          ? parsed.returnTo
          : null,
        issuedAt: typeof parsed.issuedAt === 'string' && parsed.issuedAt.trim().length > 0
          ? parsed.issuedAt
          : null
      };
    } catch {
      return { returnTo: null, issuedAt: null };
    }
  }

  private resolveReturnTo(returnToRaw: string | null): string {
    const fallback = this.configuration.authFrontendBaseUrl;
    if (!returnToRaw) {
      return fallback;
    }

    try {
      const fallbackUrl = new URL(fallback);
      const returnToUrl = new URL(returnToRaw);
      if (returnToUrl.origin !== fallbackUrl.origin) {
        return fallback;
      }

      return returnToUrl.toString();
    } catch {
      return fallback;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    const form = new URLSearchParams();
    form.set('code', code);
    form.set('client_id', this.configuration.googleClientId);
    form.set('client_secret', this.configuration.googleClientSecret);
    form.set('redirect_uri', this.configuration.googleRedirectUri);
    form.set('grant_type', 'authorization_code');

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      });

      const payload = await response.json() as GoogleTokenResponse;
      if (!response.ok) {
        const errorDescription = (payload.error_description ?? '').trim();
        const errorCode = (payload.error ?? '').trim();
        return {
          success: false,
          error: errorDescription || errorCode || `Google token endpoint failed with HTTP ${response.status}.`
        };
      }

      const accessToken = (payload.access_token ?? '').trim();
      if (!accessToken) {
        return {
          success: false,
          error: 'Google token endpoint returned an empty access token.'
        };
      }

      return {
        success: true,
        accessToken
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Google token exchange request failed: ${errorMessage}`
      };
    }
  }

  private async loadGoogleUserProfile(accessToken: string): Promise<GoogleIdentityProfile | null> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json() as GoogleUserInfoResponse;
      const userId = (payload.sub ?? '').trim();
      if (!userId) {
        return null;
      }

      const email = (payload.email ?? '').trim();
      const name = (payload.name ?? '').trim();
      const picture = (payload.picture ?? '').trim();

      return {
        providerUserId: userId,
        email: email || null,
        name: name || null,
        picture: picture || null
      };
    } catch {
      return null;
    }
  }
}
