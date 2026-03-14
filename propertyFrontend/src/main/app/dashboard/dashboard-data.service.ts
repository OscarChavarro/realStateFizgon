import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiRuntimeConfigService } from 'src/app/api/api-runtime-config.service';
import { DashboardPropertyRow, SortCriterion } from 'src/app/dashboard/dashboard.types';
import { DashboardFiltersState } from 'src/app/dashboard/filters/dashboard-filters.model';

type PropertiesCountResponse = {
  count: number;
};

type FrontendSecrets = {
  staticMedia?: string;
  backend?: {
    baseUrl?: string;
  };
};

type PropertiesResponse = {
  error: string | null;
  data: Array<{
    publicationDate?: string | Date;
    closedBy?: string | Date | null;
    closedby?: string | Date | null;
    closed_by?: string | Date | null;
    isClosed?: boolean | string | number | null;
    closedByExists?: boolean | string | number | null;
    propertyId?: string | number;
    title?: string;
    location?: string;
    description?: string;
    advertiserComment?: string;
    url?: string;
    price?: number | string | null;
    images?: Array<string | {
      url?: string;
      localUrl?: string | null;
      title?: string | null;
    }>;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalElements: number;
  };
};

type DashboardDataResult = {
  count: number;
  properties: DashboardPropertyRow[];
};

type DashboardConfiguration = {
  backendBaseUrl: string;
  staticMediaBaseUrl: string;
};

@Injectable({
  providedIn: 'root'
})
export class DashboardDataService {
  async loadBackendConfiguration(http: HttpClient): Promise<DashboardConfiguration> {
    try {
      const secrets = await firstValueFrom(http.get<FrontendSecrets>('/secrets.json'));
      const configuredBaseUrl = secrets.backend?.baseUrl?.trim();
      const configuredStaticMedia = secrets.staticMedia?.trim();

      return {
        backendBaseUrl: configuredBaseUrl
          ? this.normalizeBackendBaseUrl(configuredBaseUrl)
          : ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL,
        staticMediaBaseUrl: configuredStaticMedia
          ? this.normalizeStaticMediaBaseUrl(configuredStaticMedia)
          : ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL
      };
    } catch {
      return {
        backendBaseUrl: ApiRuntimeConfigService.DEFAULT_BACKEND_BASE_URL,
        staticMediaBaseUrl: ApiRuntimeConfigService.DEFAULT_STATIC_MEDIA_BASE_URL
      };
    }
  }

  async loadDashboardData(
    http: HttpClient,
    sortCriteria: SortCriterion[],
    filters: DashboardFiltersState
  ): Promise<DashboardDataResult> {
    try {
      const response = await firstValueFrom(
        http.get<PropertiesResponse>(
          this.buildPropertiesEndpointUrl(sortCriteria, filters)
        )
      );
      const fallbackCount = response.pagination.totalElements ?? response.data.length;
      const totalCount = await this.loadTotalCount(http, fallbackCount);

      return {
        count: totalCount,
        properties: this.mapPropertiesForDashboard(response.data)
      };
    } catch {
      const totalCount = await this.loadTotalCount(http, 0);
      return {
        count: totalCount,
        properties: []
      };
    }
  }

  private normalizeBackendBaseUrl(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
  }

  private normalizeStaticMediaBaseUrl(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
  }

  private buildPropertiesEndpointUrl(
    sortCriteria: SortCriterion[],
    filters: DashboardFiltersState
  ): string {
    const searchParams = new URLSearchParams();
    searchParams.set('showClosed', filters.showClosed ? 'true' : 'false');
    searchParams.set('showNew', filters.showNew ? 'true' : 'false');
    searchParams.set('showFavourite', filters.showFavourite ? 'true' : 'false');
    searchParams.set('showRejected', filters.showRejected ? 'true' : 'false');
    if (filters.minPublicationDate.trim().length > 0) {
      searchParams.set('minPublicationDate', filters.minPublicationDate.trim());
    }
    if (filters.maxPublicationDate.trim().length > 0) {
      searchParams.set('maxPublicationDate', filters.maxPublicationDate.trim());
    }
    for (const criterion of sortCriteria) {
      searchParams.append('sortOrder', criterion.sortOrder);
      searchParams.append('sortBy', criterion.sortBy);
    }

    return `/properties?${searchParams.toString()}`;
  }

  private mapPropertiesForDashboard(rawRows: PropertiesResponse['data']): DashboardPropertyRow[] {
    return rawRows.map((row) => {
      const closedByValue = row.closedBy ?? row.closedby ?? row.closed_by;
      const closedByExistsFromPayload = (
        Object.prototype.hasOwnProperty.call(row, 'closedBy')
        || Object.prototype.hasOwnProperty.call(row, 'closedby')
        || Object.prototype.hasOwnProperty.call(row, 'closed_by')
        || Object.prototype.hasOwnProperty.call(row, 'closedByExists')
      );

      const publicationDate = this.toDateTimeString(row.publicationDate);
      const publicationDateShort = this.toDateOnlyString(row.publicationDate);
      const propertyId = row.propertyId === undefined || row.propertyId === null
        ? ''
        : String(row.propertyId);

      const title = typeof row.title === 'string' && row.title.trim().length > 0
        ? row.title.trim()
        : '-';
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      const location = typeof row.location === 'string' && row.location.trim().length > 0
        ? row.location.trim()
        : '';
      const advertiserComment = typeof row.advertiserComment === 'string' && row.advertiserComment.trim().length > 0
        ? row.advertiserComment.trim()
        : (typeof row.description === 'string' ? row.description.trim() : '');
      const price = row.price === null || row.price === undefined
        ? '-'
        : String(row.price);

      return {
        propertyId,
        publicationDate,
        publicationDateShort,
        title,
        url,
        price,
        location,
        advertiserComment,
        localImageUrls: this.extractLocalImageUrls(row.images),
        unavailable: this.isUnavailable(
          closedByValue,
          row.isClosed,
          row.closedByExists ?? closedByExistsFromPayload
        )
      };
    });
  }

  private async loadTotalCount(http: HttpClient, fallback: number): Promise<number> {
    try {
      const countResponse = await firstValueFrom(
        http.get<PropertiesCountResponse>('/properties/count')
      );
      return countResponse.count;
    } catch {
      return fallback;
    }
  }

  private toDateOnlyString(value: unknown): string {
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) {
        return '';
      }

      const isoDatePrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoDatePrefix) {
        return isoDatePrefix[1];
      }

      const parsedFromString = new Date(raw);
      if (!Number.isNaN(parsedFromString.getTime())) {
        return this.formatLocalDate(parsedFromString);
      }

      return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return this.formatLocalDate(value);
    }

    return '';
  }

  private toDateTimeString(value: unknown): string {
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) {
        return '';
      }

      const parsedFromString = new Date(raw);
      if (!Number.isNaN(parsedFromString.getTime())) {
        return parsedFromString.toISOString();
      }

      return raw;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    return '';
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractLocalImageUrls(images: PropertiesResponse['data'][number]['images']): string[] {
    if (!Array.isArray(images)) {
      return [];
    }

    const localUrls: string[] = [];
    for (const imageItem of images) {
      if (typeof imageItem !== 'object' || imageItem === null) {
        continue;
      }

      const localUrl = typeof imageItem.localUrl === 'string' ? imageItem.localUrl.trim() : '';
      if (localUrl.length > 0) {
        localUrls.push(localUrl);
      }
    }

    return localUrls;
  }

  private hasClosedByValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }

    return true;
  }

  private isUnavailable(closedBy: unknown, isClosed: unknown, closedByExists: unknown): boolean {
    if (typeof closedByExists === 'boolean') {
      if (closedByExists) {
        return true;
      }
    } else if (typeof closedByExists === 'string') {
      const normalized = closedByExists.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
    } else if (typeof closedByExists === 'number' && closedByExists !== 0) {
      return true;
    }

    if (typeof isClosed === 'boolean') {
      return isClosed;
    }

    if (typeof isClosed === 'string') {
      const normalized = isClosed.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') {
        return false;
      }
    }

    if (typeof isClosed === 'number') {
      return isClosed !== 0;
    }

    return this.hasClosedByValue(closedBy);
  }
}
