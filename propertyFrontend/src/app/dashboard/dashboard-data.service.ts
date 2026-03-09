import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DashboardPropertyRow, SortCriterion } from 'src/app/dashboard/dashboard.types';

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
    createdAt?: string | Date;
    closedBy?: string | Date | null;
    closedby?: string | Date | null;
    closed_by?: string | Date | null;
    isClosed?: boolean | string | number | null;
    closedByExists?: boolean | string | number | null;
    propertyId?: string | number;
    createdBy?: string;
    importedBy?: string;
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
  static readonly DEFAULT_BACKEND_BASE_URL = 'http://192.168.1.110:4200';
  static readonly DEFAULT_STATIC_MEDIA_BASE_URL = 'http://localhost:666/';

  async loadBackendConfiguration(http: HttpClient): Promise<DashboardConfiguration> {
    try {
      const secrets = await firstValueFrom(http.get<FrontendSecrets>('/secrets.json'));
      const configuredBaseUrl = secrets.backend?.baseUrl?.trim();
      const configuredStaticMedia = secrets.staticMedia?.trim();

      return {
        backendBaseUrl: configuredBaseUrl
          ? this.normalizeBackendBaseUrl(configuredBaseUrl)
          : DashboardDataService.DEFAULT_BACKEND_BASE_URL,
        staticMediaBaseUrl: configuredStaticMedia
          ? this.normalizeStaticMediaBaseUrl(configuredStaticMedia)
          : DashboardDataService.DEFAULT_STATIC_MEDIA_BASE_URL
      };
    } catch {
      return {
        backendBaseUrl: DashboardDataService.DEFAULT_BACKEND_BASE_URL,
        staticMediaBaseUrl: DashboardDataService.DEFAULT_STATIC_MEDIA_BASE_URL
      };
    }
  }

  async loadDashboardData(
    http: HttpClient,
    backendBaseUrl: string,
    sortCriteria: SortCriterion[],
    showClosed: boolean
  ): Promise<DashboardDataResult> {
    try {
      const response = await firstValueFrom(
        http.get<PropertiesResponse>(this.buildPropertiesEndpointUrl(backendBaseUrl, sortCriteria, showClosed))
      );

      return {
        count: response.pagination.totalElements ?? response.data.length,
        properties: this.mapPropertiesForDashboard(response.data)
      };
    } catch {
      try {
        const countResponse = await firstValueFrom(
          http.get<PropertiesCountResponse>(`${backendBaseUrl}/properties/count`)
        );

        return {
          count: countResponse.count,
          properties: []
        };
      } catch {
        return {
          count: 0,
          properties: []
        };
      }
    }
  }

  private normalizeBackendBaseUrl(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
  }

  private normalizeStaticMediaBaseUrl(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
  }

  private buildPropertiesEndpointUrl(
    backendBaseUrl: string,
    sortCriteria: SortCriterion[],
    showClosed: boolean
  ): string {
    const url = new URL(`${backendBaseUrl}/properties`);
    url.searchParams.set('showClosed', showClosed ? 'true' : 'false');
    for (const criterion of sortCriteria) {
      url.searchParams.append('sortOrder', criterion.sortOrder);
      url.searchParams.append('sortBy', criterion.sortBy);
    }

    return url.toString();
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

      const createdAt = this.toDateOnlyString(
        row.createdAt
        ?? row.createdBy
        ?? row.importedBy
      );
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
        createdAt,
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
