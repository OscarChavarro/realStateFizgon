import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GeoLocationHint, ListingPropertyRow, SortCriterion } from 'src/app/listing/model/listing.types';
import { ListingFiltersState } from 'src/app/listing/model/filters/listing-filters.model';
import {
  ListingConfiguration,
  ListingDataResult,
  PropertiesCountResponse,
  PropertiesResponse
} from 'src/app/listing/model/listing-data.payload.types';
import { ListingConfigurationPayloadMapperService } from 'src/app/listing/services/mappers/listing-configuration-payload-mapper.service';
import { ListingPropertiesPayloadMapperService } from 'src/app/listing/services/mappers/listing-properties-payload-mapper.service';

@Injectable({
  providedIn: 'root'
})
export class ListingDataService {
  constructor(
    private readonly listingConfigurationPayloadMapperService: ListingConfigurationPayloadMapperService = new ListingConfigurationPayloadMapperService(),
    private readonly listingPropertiesPayloadMapperService: ListingPropertiesPayloadMapperService = new ListingPropertiesPayloadMapperService()
  ) {}

  async loadBackendConfiguration(http: HttpClient): Promise<ListingConfiguration> {
    try {
      const secrets = await firstValueFrom(http.get('/secrets.json'));
      return this.listingConfigurationPayloadMapperService.toListingConfiguration(secrets);
    } catch {
      return this.listingConfigurationPayloadMapperService.toListingConfiguration(null);
    }
  }

  async loadListingData(
    http: HttpClient,
    sortCriteria: SortCriterion[],
    filters: ListingFiltersState,
    page: number,
    pageSize: number
  ): Promise<ListingDataResult> {
    const normalizedPage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    const normalizedPageSize = Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : 100;

    try {
      let response: PropertiesResponse;
      let effectiveRequestPageSize = normalizedPageSize;
      try {
        response = await firstValueFrom(
          http.get<PropertiesResponse>(
            this.buildPropertiesEndpointUrl(sortCriteria, filters, normalizedPage, effectiveRequestPageSize, true)
          )
        );
      } catch (error) {
        const pageSizeLimitFromError = this.extractMaxAllowedPageSize(error);
        if (pageSizeLimitFromError !== null) {
          effectiveRequestPageSize = pageSizeLimitFromError;
          response = await firstValueFrom(
            http.get<PropertiesResponse>(
              this.buildPropertiesEndpointUrl(sortCriteria, filters, normalizedPage, effectiveRequestPageSize, true)
            )
          );
        } else {
          effectiveRequestPageSize = 1;
          response = await firstValueFrom(
            http.get<PropertiesResponse>(
              this.buildPropertiesEndpointUrl(sortCriteria, filters, 1, effectiveRequestPageSize, true)
            )
          );
        }
      }
      const fallbackCount = response.pagination.totalElements ?? response.data.length;
      const totalCount = await this.loadTotalCount(http, fallbackCount);
      const filteredTotalElements = response.pagination.totalElements ?? response.data.length;
      const responsePage = Number.isFinite(response.pagination.page) && response.pagination.page >= 1
        ? response.pagination.page
        : normalizedPage;
      const totalPages = filteredTotalElements > 0
        ? Math.ceil(filteredTotalElements / normalizedPageSize)
        : 0;
      const normalizedOutputPage = totalPages > 0
        ? Math.min(Math.max(responsePage, 1), totalPages)
        : 1;

      return {
        count: totalCount,
        properties: this.mapPropertiesForListing(response.data),
        pagination: {
          page: normalizedOutputPage,
          pageSize: normalizedPageSize,
          totalElements: filteredTotalElements,
          totalPages
        }
      };
    } catch {
      const totalCount = await this.loadTotalCount(http, 0);
      return {
        count: totalCount,
        properties: [],
        pagination: {
          page: normalizedPage,
          pageSize: normalizedPageSize,
          totalElements: 0,
          totalPages: 0
        }
      };
    }
  }

  private extractMaxAllowedPageSize(error: unknown): number | null {
    return this.listingPropertiesPayloadMapperService.extractMaxAllowedPageSize(error);
  }

  private normalizeBackendBaseUrl(value: string): string {
    return this.listingConfigurationPayloadMapperService.normalizeBackendBaseUrl(value);
  }

  private normalizeStaticMediaBaseUrl(value: string): string {
    return this.listingConfigurationPayloadMapperService.normalizeStaticMediaBaseUrl(value);
  }

  private normalizeGoogleMapsApiKey(value: unknown): string | null {
    return this.listingConfigurationPayloadMapperService.normalizeGoogleMapsApiKey(value);
  }

  private normalizeGoogleMapsMapId(value: unknown): string | null {
    return this.listingConfigurationPayloadMapperService.normalizeGoogleMapsMapId(value);
  }

  private buildPropertiesEndpointUrl(
    sortCriteria: SortCriterion[],
    filters: ListingFiltersState,
    page: number,
    pageSize: number,
    includePaginationParams: boolean
  ): string {
    const searchParams = new URLSearchParams();
    if (includePaginationParams) {
      searchParams.set('page', String(page));
      searchParams.set('pageSize', String(pageSize));
    }
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
    if (filters.minPrice.trim().length > 0) {
      searchParams.set('minPrice', filters.minPrice.trim());
    }
    if (filters.maxPrice.trim().length > 0) {
      searchParams.set('maxPrice', filters.maxPrice.trim());
    }
    for (const criterion of sortCriteria) {
      searchParams.append('sortOrder', criterion.sortOrder);
      searchParams.append('sortBy', criterion.sortBy);
    }

    return `/properties?${searchParams.toString()}`;
  }

  private mapPropertiesForListing(rawRows: PropertiesResponse['data']): ListingPropertyRow[] {
    return this.listingPropertiesPayloadMapperService.mapPropertiesForListing(rawRows);
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
    return this.listingPropertiesPayloadMapperService.toDateOnlyString(value);
  }

  private normalizeMainFeatureValue(value: unknown): string {
    return this.listingPropertiesPayloadMapperService.normalizeMainFeatureValue(value);
  }

  private toDateTimeString(value: unknown): string {
    return this.listingPropertiesPayloadMapperService.toDateTimeString(value);
  }

  private extractLocalImageUrls(images: PropertiesResponse['data'][number]['images']): string[] {
    return this.listingPropertiesPayloadMapperService.extractLocalImageUrls(images);
  }

  private parseGeoLocationHint(value: PropertiesResponse['data'][number]['geoLocationHint']): GeoLocationHint | null {
    return this.listingPropertiesPayloadMapperService.parseGeoLocationHint(value);
  }

  private toFiniteNumber(value: unknown): number | null {
    return this.listingPropertiesPayloadMapperService.toFiniteNumber(value);
  }

  private hasClosedByValue(value: unknown): boolean {
    return this.listingPropertiesPayloadMapperService.hasClosedByValue(value);
  }

  private isUnavailable(closedBy: unknown, isClosed: unknown, closedByExists: unknown): boolean {
    return this.listingPropertiesPayloadMapperService.isUnavailable(closedBy, isClosed, closedByExists);
  }
}
