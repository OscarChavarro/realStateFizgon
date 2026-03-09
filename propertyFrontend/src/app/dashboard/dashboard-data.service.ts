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
    sortCriteria: SortCriterion[]
  ): Promise<DashboardDataResult> {
    try {
      const response = await firstValueFrom(
        http.get<PropertiesResponse>(this.buildPropertiesEndpointUrl(backendBaseUrl, sortCriteria))
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

  private buildPropertiesEndpointUrl(backendBaseUrl: string, sortCriteria: SortCriterion[]): string {
    const url = new URL(`${backendBaseUrl}/properties`);
    for (const criterion of sortCriteria) {
      url.searchParams.append('sortOrder', criterion.sortOrder);
      url.searchParams.append('sortBy', criterion.sortBy);
    }

    return url.toString();
  }

  private mapPropertiesForDashboard(rawRows: PropertiesResponse['data']): DashboardPropertyRow[] {
    return rawRows.map((row) => {
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
        localImageUrls: this.extractLocalImageUrls(row.images)
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
}
