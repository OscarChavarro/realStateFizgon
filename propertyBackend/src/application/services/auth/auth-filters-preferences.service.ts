import { Injectable } from '@nestjs/common';
import { AuthUserRepository } from 'src/adapters/outbound/persistence/mongodb/auth-user.repository';

export type AuthFiltersPreferences = {
  showClosed: boolean;
};

@Injectable()
export class AuthFiltersPreferencesService {
  constructor(private readonly authUserRepository: AuthUserRepository) {}

  async getFiltersPreferences(userId: string): Promise<AuthFiltersPreferences> {
    const preferences = await this.authUserRepository.getUserPreferences(userId);
    return {
      showClosed: this.toBoolean(preferences['showClosed'], true)
    };
  }

  async saveFiltersPreferences(userId: string, preferences: AuthFiltersPreferences): Promise<AuthFiltersPreferences> {
    const normalized: AuthFiltersPreferences = {
      showClosed: this.toBoolean(preferences.showClosed, true)
    };

    const merged = await this.authUserRepository.mergeUserPreferences(userId, normalized);
    return {
      showClosed: this.toBoolean(merged['showClosed'], true)
    };
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
