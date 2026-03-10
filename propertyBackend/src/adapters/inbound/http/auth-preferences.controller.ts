import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';
import {
  AuthUserPreferences,
  AuthUserPreferencesService,
  PropertyReviewLabel
} from 'src/application/services/auth/auth-user-preferences.service';

type HttpRequestLike = {
  headers?: {
    cookie?: string;
  };
};

type SaveFiltersPreferencesBody = {
  showClosed?: unknown;
};

type SetPropertyLabelsBody = {
  propertyId?: unknown;
  labels?: unknown;
};

@Controller('auth/preferences')
export class AuthPreferencesController {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly authUserPreferencesService: AuthUserPreferencesService
  ) {}

  @Get()
  async getPreferences(@Req() request: HttpRequestLike): Promise<AuthUserPreferences> {
    const userId = this.getOptionalUserId(request);
    if (!userId) {
      return {
        showClosed: true,
        propertyLabels: []
      };
    }

    return this.authUserPreferencesService.getPreferences(userId);
  }

  @Get('filters')
  async getFiltersPreferences(@Req() request: HttpRequestLike): Promise<{ showClosed: boolean }> {
    const preferences = await this.getPreferences(request);
    return { showClosed: preferences.showClosed };
  }

  @Post('filters')
  async saveFiltersPreferences(
    @Req() request: HttpRequestLike,
    @Body() body: SaveFiltersPreferencesBody
  ): Promise<{ showClosed: boolean }> {
    const userId = this.getOptionalUserId(request);
    const showClosed = this.toBoolean(body?.showClosed, true);
    if (!userId) {
      return { showClosed };
    }

    const preferences = await this.authUserPreferencesService.saveFiltersPreferences(userId, { showClosed });
    return { showClosed: preferences.showClosed };
  }

  @Post('setPropertyLabels')
  async setPropertyLabels(
    @Req() request: HttpRequestLike,
    @Body() body: SetPropertyLabelsBody
  ): Promise<AuthUserPreferences> {
    const userId = this.getOptionalUserId(request);
    const propertyId = this.toTrimmedString(body?.propertyId);
    const labels = this.normalizeLabels(body?.labels);
    if (!userId) {
      if (!propertyId || Object.keys(labels).length === 0) {
        return {
          showClosed: true,
          propertyLabels: []
        };
      }

      return {
        showClosed: true,
        propertyLabels: [
          {
            propertyId,
            labels
          }
        ]
      };
    }

    return this.authUserPreferencesService.setPropertyLabels(userId, propertyId, labels);
  }

  private getOptionalUserId(request: HttpRequestLike): string | null {
    const user = this.authSessionService.findUserByCookieHeader(request?.headers?.cookie);
    if (!user) {
      return null;
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

  private toTrimmedString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  private normalizeLabels(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    const labels = { ...(value as Record<string, unknown>) };
    const reviewRaw = labels['review'];
    if (typeof reviewRaw === 'string') {
      const normalized = reviewRaw.trim().toUpperCase() as PropertyReviewLabel;
      if (normalized === 'NEW' || normalized === 'FAVOURITE' || normalized === 'DISCHARGED') {
        labels['review'] = normalized;
      } else {
        delete labels['review'];
      }
    }

    const commentsRaw = labels['propertyComments'];
    if (commentsRaw !== undefined) {
      if (typeof commentsRaw === 'string') {
        labels['propertyComments'] = commentsRaw.trim();
      } else {
        delete labels['propertyComments'];
      }
    }

    return labels;
  }
}
