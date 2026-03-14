import { Controller, Get, HttpException, HttpStatus, Query, Req } from '@nestjs/common';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import {
  MongoRepository,
  PropertiesPriceRange,
  PropertySortCriterion,
  PropertySortField,
  PropertySortOrder,
  PropertiesQueryFilter
} from 'src/adapters/outbound/persistence/mongodb/mongo.repository';
import {
  AuthUserPreferencesService,
  UserPropertyLabels
} from 'src/application/services/auth/auth-user-preferences.service';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';

type HttpRequestLike = {
  originalUrl?: string;
  url?: string;
  headers?: {
    cookie?: string;
  };
};

type ReviewFilterState = {
  showNew: boolean;
  showFavourite: boolean;
  showRejected: boolean;
};

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly mongoRepository: MongoRepository,
    private readonly authSessionService: AuthSessionService,
    private readonly authUserPreferencesService: AuthUserPreferencesService
  ) {}

  @Get('count')
  async getPropertiesCount(): Promise<{ count: number }> {
    const count = await this.mongoDatabaseService.countProperties();
    return { count };
  }

  @Get('getPriceRanges')
  async getPriceRanges(): Promise<PropertiesPriceRange> {
    return this.mongoRepository.getPriceRanges();
  }

  @Get()
  async getProperties(
    @Req() request: HttpRequestLike,
    @Query('page') pageQuery?: string,
    @Query('pageSize') pageSizeQuery?: string,
    @Query('showClosed') showClosedQuery?: string,
    @Query('showNew') showNewQuery?: string,
    @Query('showFavourite') showFavouriteQuery?: string,
    @Query('showRejected') showRejectedQuery?: string,
    @Query('minPublicationDate') minPublicationDateQuery?: string,
    @Query('maxPublicationDate') maxPublicationDateQuery?: string,
    @Query('minPrice') minPriceQuery?: string,
    @Query('maxPrice') maxPriceQuery?: string
  ): Promise<{
    error: string | null;
    data: unknown[];
    pagination: {
      page: number;
      pageSize: number;
      totalElements: number;
    };
  }> {
    const showClosed = this.parseBooleanOrDefault(showClosedQuery, true, 'showClosed');
    const reviewFilterState: ReviewFilterState = {
      showNew: this.parseBooleanOrDefault(showNewQuery, true, 'showNew'),
      showFavourite: this.parseBooleanOrDefault(showFavouriteQuery, true, 'showFavourite'),
      showRejected: this.parseBooleanOrDefault(showRejectedQuery, true, 'showRejected')
    };
    const propertiesQueryFilter = this.parsePropertiesQueryFilter(
      minPublicationDateQuery,
      maxPublicationDateQuery,
      minPriceQuery,
      maxPriceQuery
    );
    const sortCriteria = this.parseSortCriteriaFromRawQuery(this.readRawQueryString(request));
    const userId = this.getOptionalUserId(request);
    const shouldApplyReviewFilter = userId !== null && this.shouldApplyReviewFiltering(reviewFilterState);

    let totalElements = 0;
    let defaultPageSize = 0;
    let data: unknown[] = [];
    const defaultPage = 1;

    if (shouldApplyReviewFilter && userId) {
      const allRows = await this.mongoRepository.findAllPropertiesSorted(
        sortCriteria,
        showClosed,
        propertiesQueryFilter
      );
      const preferences = await this.authUserPreferencesService.getPreferences(userId);
      const filteredRows = this.applyReviewFilter(allRows, preferences.propertyLabels, reviewFilterState);
      totalElements = filteredRows.length;
      defaultPageSize = totalElements;

      const page = this.parsePositiveIntOrDefault(pageQuery, defaultPage, 'page');
      const pageSize = this.parsePositiveIntOrDefault(pageSizeQuery, defaultPageSize, 'pageSize');
      this.assertPageSizeWithinTotal(pageSize, totalElements);
      data = this.paginateInMemory(filteredRows, page, pageSize);

      const normalizedData = data.map((item) => this.normalizePropertyPayload(item));
      return {
        error: null,
        data: normalizedData,
        pagination: {
          page,
          pageSize,
          totalElements
        }
      };
    }

    totalElements = await this.mongoRepository.countProperties(showClosed, propertiesQueryFilter);
    defaultPageSize = totalElements;
    const page = this.parsePositiveIntOrDefault(pageQuery, defaultPage, 'page');
    const pageSize = this.parsePositiveIntOrDefault(pageSizeQuery, defaultPageSize, 'pageSize');
    this.assertPageSizeWithinTotal(pageSize, totalElements);

    data = pageSize === 0
      ? []
      : await this.mongoRepository.findAllPropertiesPaginated(
        page,
        pageSize,
        sortCriteria,
        showClosed,
        propertiesQueryFilter
      );
    const normalizedData = data.map((item) => this.normalizePropertyPayload(item));

    return {
      error: null,
      data: normalizedData,
      pagination: {
        page,
        pageSize,
        totalElements
      }
    };
  }

  private parsePositiveIntOrDefault(value: string | undefined, fallback: number, fieldName: string): number {
    if (value === undefined || value.trim().length === 0) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      this.throwPaginationBadRequest(`Invalid ${fieldName}="${value}". Expected a positive integer.`);
    }

    return parsed;
  }

  private parseSortCriteriaFromRawQuery(rawQuery: string): PropertySortCriterion[] {
    const allowedSortFields = new Set<PropertySortField>([
      'title',
      'location',
      'mainFeatures.area',
      'mainFeatures.bedrooms',
      'publicationDate',
      'importedBy',
      'price',
      'propertyId'
    ]);
    const allowedQueryParams = new Set([
      'page',
      'pageSize',
      'showClosed',
      'showNew',
      'showFavourite',
      'showRejected',
      'minPublicationDate',
      'maxPublicationDate',
      'minPrice',
      'maxPrice',
      'sortBy',
      'sortOrder'
    ]);
    const params = new URLSearchParams(rawQuery);
    const criteria: PropertySortCriterion[] = [];
    const seenSortBy = new Set<PropertySortField>();
    let currentOrder: PropertySortOrder = 'asc';

    for (const [key, rawValue] of params.entries()) {
      if (!allowedQueryParams.has(key)) {
        this.throwSortBadRequest(
          `Unknown query parameter "${key}". Allowed parameters: page, pageSize, showClosed, showNew, showFavourite, showRejected, minPublicationDate, maxPublicationDate, minPrice, maxPrice, sortBy, sortOrder.`
        );
      }

      const value = rawValue.trim();
      if (key === 'sortOrder') {
        if (value !== 'asc' && value !== 'desc') {
          this.throwSortBadRequest(`Invalid sortOrder="${rawValue}". Expected "asc" or "desc".`);
        }
        currentOrder = value;
        continue;
      }

      if (key === 'sortBy') {
        if (!allowedSortFields.has(value as PropertySortField)) {
          this.throwSortBadRequest(
            `Invalid sortBy="${rawValue}". Allowed values: ${Array.from(allowedSortFields).join(', ')}.`
          );
        }

        const sortField = value as PropertySortField;
        if (seenSortBy.has(sortField)) {
          this.throwSortBadRequest(`Invalid sortBy="${rawValue}". Duplicate sort field is not allowed.`);
        }

        seenSortBy.add(sortField);
        criteria.push({
          sortBy: sortField,
          order: currentOrder
        });
      }
    }

    return criteria;
  }

  private parsePropertiesQueryFilter(
    minPublicationDateQuery: string | undefined,
    maxPublicationDateQuery: string | undefined,
    minPriceQuery: string | undefined,
    maxPriceQuery: string | undefined
  ): PropertiesQueryFilter {
    const minPublicationDate = this.parseDateQueryValue(minPublicationDateQuery, 'minPublicationDate', false);
    const maxPublicationDate = this.parseDateQueryValue(maxPublicationDateQuery, 'maxPublicationDate', true);
    if (minPublicationDate && maxPublicationDate && minPublicationDate > maxPublicationDate) {
      this.throwPaginationBadRequest(
        'Invalid publication date range. minPublicationDate cannot be greater than maxPublicationDate.'
      );
    }
    const minPrice = this.parsePriceQueryValue(minPriceQuery, 'minPrice');
    const maxPrice = this.parsePriceQueryValue(maxPriceQuery, 'maxPrice');
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      this.throwPaginationBadRequest(
        'Invalid price range. minPrice cannot be greater than maxPrice.'
      );
    }

    return {
      minPublicationDate: minPublicationDate ?? undefined,
      maxPublicationDate: maxPublicationDate ?? undefined,
      minPrice: minPrice ?? undefined,
      maxPrice: maxPrice ?? undefined
    };
  }

  private parseDateQueryValue(
    value: string | undefined,
    fieldName: 'minPublicationDate' | 'maxPublicationDate',
    endOfDay: boolean
  ): Date | null {
    if (value === undefined || value.trim().length === 0) {
      return null;
    }

    const raw = value.trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      this.throwPaginationBadRequest(
        `Invalid ${fieldName}="${value}". Expected format YYYY-MM-DD.`
      );
    }

    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    const parsed = endOfDay
      ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (Number.isNaN(parsed.getTime())
      || parsed.getUTCFullYear() !== year
      || parsed.getUTCMonth() !== month - 1
      || parsed.getUTCDate() !== day) {
      this.throwPaginationBadRequest(
        `Invalid ${fieldName}="${value}". Expected a valid calendar date in format YYYY-MM-DD.`
      );
    }

    return parsed;
  }

  private parsePriceQueryValue(
    value: string | undefined,
    fieldName: 'minPrice' | 'maxPrice'
  ): number | null {
    if (value === undefined || value.trim().length === 0) {
      return null;
    }

    const parsed = Number.parseFloat(value.trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.throwPaginationBadRequest(
        `Invalid ${fieldName}="${value}". Expected a non-negative number.`
      );
    }

    return parsed;
  }

  private parseBooleanOrDefault(value: string | undefined, fallback: boolean, fieldName: string): boolean {
    if (value === undefined || value.trim().length === 0) {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }

    this.throwPaginationBadRequest(`Invalid ${fieldName}="${value}". Expected boolean true/false.`);
  }

  private readRawQueryString(request?: HttpRequestLike): string {
    const source = request?.originalUrl ?? request?.url ?? '';
    const queryIndex = source.indexOf('?');
    if (queryIndex < 0) {
      return '';
    }
    return source.slice(queryIndex + 1);
  }

  private getOptionalUserId(request?: HttpRequestLike): string | null {
    const user = this.authSessionService.findUserByCookieHeader(request?.headers?.cookie);
    if (!user) {
      return null;
    }

    return user.id;
  }

  private shouldApplyReviewFiltering(filter: ReviewFilterState): boolean {
    return !(filter.showNew && filter.showFavourite && filter.showRejected);
  }

  private applyReviewFilter(
    rows: unknown[],
    propertyLabels: UserPropertyLabels[],
    filter: ReviewFilterState
  ): unknown[] {
    const reviewByPropertyId = new Map<string, 'NEW' | 'FAVOURITE' | 'DISCHARGED'>();
    for (const labelEntry of propertyLabels) {
      const propertyId = labelEntry.propertyId.trim();
      if (!propertyId) {
        continue;
      }

      const reviewRaw = labelEntry.labels.review;
      if (reviewRaw === 'NEW' || reviewRaw === 'FAVOURITE' || reviewRaw === 'DISCHARGED') {
        reviewByPropertyId.set(propertyId, reviewRaw);
      }
    }

    return rows.filter((row) => {
      const propertyId = this.readPropertyId(row);
      const review = propertyId ? (reviewByPropertyId.get(propertyId) ?? 'NEW') : 'NEW';

      if (review === 'NEW') {
        return filter.showNew;
      }
      if (review === 'FAVOURITE') {
        return filter.showFavourite;
      }
      return filter.showRejected;
    });
  }

  private readPropertyId(row: unknown): string {
    if (typeof row !== 'object' || row === null) {
      return '';
    }

    const propertyIdRaw = (row as { propertyId?: unknown }).propertyId;
    if (propertyIdRaw === null || propertyIdRaw === undefined) {
      return '';
    }

    return String(propertyIdRaw).trim();
  }

  private paginateInMemory(rows: unknown[], page: number, pageSize: number): unknown[] {
    if (pageSize === 0) {
      return [];
    }

    const skip = (page - 1) * pageSize;
    return rows.slice(skip, skip + pageSize);
  }

  private assertPageSizeWithinTotal(pageSize: number, totalElements: number): void {
    if (pageSize > totalElements) {
      this.throwPaginationBadRequest(
        `Invalid pageSize=${pageSize}. pageSize cannot be greater than total properties (${totalElements}).`
      );
    }
  }

  private throwPaginationBadRequest(message: string): never {
    throw new HttpException(
      {
        error: message,
        data: [],
        pagination: {}
      },
      HttpStatus.BAD_REQUEST
    );
  }

  private throwSortBadRequest(message: string): never {
    throw new HttpException(
      {
        data: null,
        error: message
      },
      HttpStatus.BAD_REQUEST
    );
  }

  private normalizePropertyPayload(item: unknown): unknown {
    if (typeof item !== 'object' || item === null) {
      return item;
    }

    const payload = { ...(item as Record<string, unknown>) };
    const closedByExists = Object.prototype.hasOwnProperty.call(payload, 'closedBy');

    const title = typeof payload.title === 'string' ? payload.title : null;
    if (title) {
      const prefix = 'Alquiler de piso en ';
      if (title.startsWith(prefix)) {
        payload.title = title.slice(prefix.length);
      }
    }

    payload.images = this.normalizeImagesWithLocalUrl(payload.images);
    payload.publicationDate = this.normalizeDateLikeValue(payload.publicationDate);
    const normalizedClosedBy = this.normalizeClosedBy(payload.closedBy);
    payload.closedBy = normalizedClosedBy;
    payload.closedByExists = closedByExists;
    payload.isClosed = closedByExists && normalizedClosedBy !== null;

    return payload;
  }

  private normalizeImagesWithLocalUrl(images: unknown): unknown {
    if (!Array.isArray(images)) {
      return images;
    }

    return images.map((imageItem) => {
      if (typeof imageItem === 'string') {
        return {
          url: imageItem,
          localUrl: this.buildLocalImageNameFromUrl(imageItem)
        };
      }

      if (typeof imageItem === 'object' && imageItem !== null) {
        const imageObject = imageItem as Record<string, unknown>;
        const imageUrl = typeof imageObject.url === 'string' ? imageObject.url : '';
        return {
          ...imageObject,
          localUrl: this.buildLocalImageNameFromUrl(imageUrl)
        };
      }

      return imageItem;
    });
  }

  private buildLocalImageNameFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    try {
      const parsedUrl = new URL(url);
      const segments = parsedUrl.pathname.split('/').filter((segment) => segment.length > 0);
      const lastFourSegments = segments.slice(-4);
      if (lastFourSegments.length < 4) {
        return null;
      }

      return lastFourSegments.join('_');
    } catch {
      return null;
    }
  }

  private normalizeClosedBy(value: unknown): string | null {
    const normalized = this.normalizeDateLikeValue(value);
    if (normalized !== null) {
      return normalized;
    }

    if (value === null || value === undefined) {
      return null;
    }

    return String(value);
  }

  private normalizeDateLikeValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
    }

    if (typeof value === 'object') {
      const dateField = (value as { $date?: unknown }).$date;
      if (typeof dateField === 'string') {
        const trimmed = dateField.trim();
        if (!trimmed) {
          return null;
        }

        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
      }
    }

    return null;
  }
}
