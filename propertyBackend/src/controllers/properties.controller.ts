import { Controller, Get, HttpException, HttpStatus, Query, Req } from '@nestjs/common';
import { MongoDatabaseService } from 'src/services/mongo-database.service';
import { MongoRepository, PropertySortCriterion, PropertySortField, PropertySortOrder } from 'src/services/mongo.repository';

type HttpRequestLike = {
  originalUrl?: string;
  url?: string;
};

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly mongoRepository: MongoRepository
  ) {}

  @Get('count')
  async getPropertiesCount(): Promise<{ count: number }> {
    const count = await this.mongoDatabaseService.countProperties();
    return { count };
  }

  @Get()
  async getProperties(
    @Req() request: HttpRequestLike,
    @Query('page') pageQuery?: string,
    @Query('pageSize') pageSizeQuery?: string
  ): Promise<{
    error: string | null;
    data: unknown[];
    pagination: {
      page: number;
      pageSize: number;
      totalElements: number;
    };
  }> {
    const totalElements = await this.mongoDatabaseService.countProperties();
    const defaultPage = 1;
    const defaultPageSize = totalElements;

    const page = this.parsePositiveIntOrDefault(pageQuery, defaultPage, 'page');
    const pageSize = this.parsePositiveIntOrDefault(pageSizeQuery, defaultPageSize, 'pageSize');
    const sortCriteria = this.parseSortCriteriaFromRawQuery(this.readRawQueryString(request));

    if (pageSize > totalElements) {
      this.throwPaginationBadRequest(
        `Invalid pageSize=${pageSize}. pageSize cannot be greater than total properties (${totalElements}).`
      );
    }

    const data = pageSize === 0
      ? []
      : await this.mongoRepository.findAllPropertiesPaginated(page, pageSize, sortCriteria);
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
      'importedBy',
      'price',
      'propertyId'
    ]);
    const allowedQueryParams = new Set(['page', 'pageSize', 'sortBy', 'sortOrder']);
    const params = new URLSearchParams(rawQuery);
    const criteria: PropertySortCriterion[] = [];
    const seenSortBy = new Set<PropertySortField>();
    let currentOrder: PropertySortOrder = 'asc';

    for (const [key, rawValue] of params.entries()) {
      if (!allowedQueryParams.has(key)) {
        this.throwSortBadRequest(`Unknown query parameter "${key}". Allowed parameters: page, pageSize, sortBy, sortOrder.`);
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

  private readRawQueryString(request?: HttpRequestLike): string {
    const source = request?.originalUrl ?? request?.url ?? '';
    const queryIndex = source.indexOf('?');
    if (queryIndex < 0) {
      return '';
    }
    return source.slice(queryIndex + 1);
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

    const title = typeof payload.title === 'string' ? payload.title : null;
    if (title) {
      const prefix = 'Alquiler de piso en ';
      if (title.startsWith(prefix)) {
        payload.title = title.slice(prefix.length);
      }
    }

    payload.images = this.normalizeImagesWithLocalUrl(payload.images);

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
}
