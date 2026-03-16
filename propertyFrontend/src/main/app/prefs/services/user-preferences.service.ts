import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import {
  PropertyLabelEntry,
  PropertyLabels,
  PropertyReviewLabel,
  SortCriterion,
  SortDirection,
} from 'src/app/listing/model/listing.types';
import { SupportedLanguage } from 'src/app/core/i18n/services/i18n.service';
import { UserPreferencesPayload } from 'src/app/prefs/model/user-preferences-payload.type';
import { UserPreferencesPayloadMapperService } from 'src/app/prefs/services/mappers/user-preferences-payload-mapper.service';

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  constructor(
    private readonly userPreferencesPayloadMapperService: UserPreferencesPayloadMapperService = new UserPreferencesPayloadMapperService()
  ) {}

  async loadPreferences(
    http: HttpClient
  ): Promise<{
    language: SupportedLanguage;
    pageSize: number;
    filters: ListingFiltersState;
    sortCriteria: SortCriterion[];
    propertyLabels: PropertyLabelEntry[];
  } | null> {
    try {
      const response = await firstValueFrom(
        http.get<UserPreferencesPayload>('/auth/preferences')
      );
      return this.userPreferencesPayloadMapperService.normalizePreferencesPayload(response);
    } catch {
      return null;
    }
  }

  async saveFilters(
    http: HttpClient,
    filters: ListingFiltersState,
    language: SupportedLanguage,
    sortCriteria: SortCriterion[],
    pageSize: number
  ): Promise<void> {
    await firstValueFrom(
      http.post(
        '/auth/preferences',
        this.userPreferencesPayloadMapperService.buildSaveFiltersPayload(filters, language, sortCriteria, pageSize)
      )
    );
  }

  async setPropertyReview(
    http: HttpClient,
    propertyId: string,
    review: PropertyReviewLabel
  ): Promise<PropertyLabelEntry[]> {
    return this.setPropertyLabels(http, propertyId, { review });
  }

  async setPropertyComment(
    http: HttpClient,
    propertyId: string,
    comment: string
  ): Promise<PropertyLabelEntry[]> {
    return this.setPropertyLabels(http, propertyId, { comment });
  }

  private async setPropertyLabels(
    http: HttpClient,
    propertyId: string,
    labels: Partial<PropertyLabels>
  ): Promise<PropertyLabelEntry[]> {
    const response = await firstValueFrom(
      http.post<UserPreferencesPayload>(
        '/auth/preferences/setPropertyLabels',
        {
          propertyId,
          labels
        }
      )
    );

    return this.userPreferencesPayloadMapperService.normalizePropertyLabels(response.propertyLabels);
  }

  private toBoolean(value: unknown, fallback: boolean): boolean {
    return this.userPreferencesPayloadMapperService.toBoolean(value, fallback);
  }

  private toSupportedLanguage(value: unknown, fallback: SupportedLanguage): SupportedLanguage {
    return this.userPreferencesPayloadMapperService.toSupportedLanguage(value, fallback);
  }

  private toDateOnlyString(value: unknown): string {
    return this.userPreferencesPayloadMapperService.toDateOnlyString(value);
  }

  private toIntegerString(value: unknown): string {
    return this.userPreferencesPayloadMapperService.toIntegerString(value);
  }

  private toPageSize(value: unknown, fallback: number): number {
    return this.userPreferencesPayloadMapperService.toPageSize(value, fallback);
  }

  private normalizePropertyLabels(value: unknown): PropertyLabelEntry[] {
    return this.userPreferencesPayloadMapperService.normalizePropertyLabels(value);
  }

  private normalizeSortCriteria(value: unknown): SortCriterion[] {
    return this.userPreferencesPayloadMapperService.normalizeSortCriteria(value);
  }

  private toSortDirection(value: unknown, fallback: SortDirection): SortDirection {
    return this.userPreferencesPayloadMapperService.toSortDirection(value, fallback);
  }
}
