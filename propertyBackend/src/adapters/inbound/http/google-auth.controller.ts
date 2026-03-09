import { Controller, Get, Post, Query, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';
import { AuthenticatedUser } from 'src/application/services/auth/authenticated-user.type';
import { GoogleOAuthBootstrapResult } from 'src/application/services/auth/google/google-oauth-bootstrap-result.type';
import { GoogleOAuthBootstrapService } from 'src/application/services/auth/google/google-oauth-bootstrap.service';

type RedirectResponse = {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      maxAge: number;
      path: string;
    }
  ): void;
  clearCookie(name: string, options: { path: string }): void;
  redirect(statusCode: number, url: string): void;
  setHeader(name: string, value: string): void;
  status(code: number): RedirectResponse;
  send(body?: unknown): void;
};

type HttpRequestLike = {
  headers?: {
    cookie?: string;
  };
};

@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly googleOAuthBootstrapService: GoogleOAuthBootstrapService,
    private readonly authSessionService: AuthSessionService
  ) {}

  @Get('login-url')
  getGoogleLoginUrl(@Query('returnTo') returnTo?: string): GoogleOAuthBootstrapResult {
    return this.googleOAuthBootstrapService.buildLoginBootstrap(returnTo);
  }

  @Get('login')
  redirectToGoogleLogin(@Query('returnTo') returnTo: string | undefined, @Res() response: RedirectResponse): void {
    const bootstrap = this.googleOAuthBootstrapService.buildLoginBootstrap(returnTo);
    if (!bootstrap.enabled || !bootstrap.authorizationUrl) {
      throw new ServiceUnavailableException({
        message: bootstrap.message,
        missingConfigFields: bootstrap.missingConfigFields
      });
    }

    response.redirect(302, bootstrap.authorizationUrl);
  }

  @Get('callback')
  async handleGoogleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() response: RedirectResponse
  ): Promise<void> {
    const completion = await this.googleOAuthBootstrapService.completeCallback({
      code,
      state,
      error,
      errorDescription
    });

    if (completion.success && completion.sessionId) {
      response.cookie(
        this.authSessionService.sessionCookieName,
        completion.sessionId,
        {
          httpOnly: true,
          secure: this.authSessionService.sessionSecureCookie,
          sameSite: 'lax',
          maxAge: this.authSessionService.sessionTtlSeconds * 1000,
          path: '/'
        }
      );
      response.redirect(302, completion.redirectTo);
      return;
    }

    const errorRedirect = new URL(completion.redirectTo);
    errorRedirect.searchParams.set('authError', completion.error ?? 'Google OAuth callback failed.');
    response.redirect(302, errorRedirect.toString());
  }

  @Get('me')
  getCurrentUser(@Req() request: HttpRequestLike): { authenticated: boolean; user: AuthenticatedUser | null } {
    const user = this.authSessionService.findUserByCookieHeader(request?.headers?.cookie);
    return {
      authenticated: user !== null,
      user
    };
  }

  @Post('logout')
  logout(@Req() request: HttpRequestLike, @Res({ passthrough: true }) response: RedirectResponse): { status: string } {
    this.authSessionService.destroySessionByCookieHeader(request?.headers?.cookie);
    response.clearCookie(this.authSessionService.sessionCookieName, { path: '/' });
    return { status: 'ok' };
  }

  @Get('avatar')
  async getUserAvatar(@Req() request: HttpRequestLike, @Res() response: RedirectResponse): Promise<void> {
    const user = this.authSessionService.findUserByCookieHeader(request?.headers?.cookie);
    const pictureUrl = (user?.picture ?? '').trim();
    if (!pictureUrl) {
      response.status(404).send();
      return;
    }

    try {
      const upstream = await fetch(pictureUrl);
      if (!upstream.ok) {
        response.status(404).send();
        return;
      }

      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
      const bytes = await upstream.arrayBuffer();
      response.setHeader('Cache-Control', 'private, max-age=300');
      response.setHeader('Content-Type', contentType);
      response.send(Buffer.from(bytes));
    } catch {
      response.status(404).send();
    }
  }
}
