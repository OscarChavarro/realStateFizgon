import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DashboardFiltersState } from 'src/app/dashboard/filters/dashboard-filters.model';

type FiltersPreferencesPayload = {
  showClosed?: unknown;
};

@Injectable({
  providedIn: 'root'
})
export class DashboardFiltersPreferencesService {
  async loadFilters(http: HttpClient, backendBaseUrl: string): Promise<DashboardFiltersState | null> {
    try {
      const response = await firstValueFrom(
        http.get<FiltersPreferencesPayload>(`${backendBaseUrl}/auth/preferences/filters`, {
          withCredentials: true
        })
      );
      return {
        showClosed: this.toBoolean(response?.showClosed, true)
      };
    } catch {
      return null;
    }
  }

  async saveFilters(http: HttpClient, backendBaseUrl: string, filters: DashboardFiltersState): Promise<void> {
    await firstValueFrom(
      http.post(
        `${backendBaseUrl}/auth/preferences/filters`,
        { showClosed: filters.showClosed },
        { withCredentials: true }
      )
    );
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
