import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';
import { AuthFiltersPreferences, AuthFiltersPreferencesService } from 'src/application/services/auth/auth-filters-preferences.service';

type HttpRequestLike = {
  headers?: {
    cookie?: string;
  };
};

type SaveFiltersPreferencesBody = {
  showClosed?: unknown;
};

@Controller('auth/preferences')
export class AuthPreferencesController {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly authFiltersPreferencesService: AuthFiltersPreferencesService
  ) {}

  @Get('filters')
  async getFiltersPreferences(@Req() request: HttpRequestLike): Promise<AuthFiltersPreferences> {
    const userId = this.getAuthenticatedUserId(request);
    return this.authFiltersPreferencesService.getFiltersPreferences(userId);
  }

  @Post('filters')
  async saveFiltersPreferences(
    @Req() request: HttpRequestLike,
    @Body() body: SaveFiltersPreferencesBody
  ): Promise<AuthFiltersPreferences> {
    const userId = this.getAuthenticatedUserId(request);
    const showClosed = this.toBoolean(body?.showClosed, true);
    return this.authFiltersPreferencesService.saveFiltersPreferences(userId, { showClosed });
  }

  private getAuthenticatedUserId(request: HttpRequestLike): string {
    const user = this.authSessionService.findUserByCookieHeader(request?.headers?.cookie);
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    return user.id;
  }

  private toBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
    }
    return fallback;
  }
}
