import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { MongoDatabaseService } from '../services/mongo-database.service';
import { MongoRepository } from '../services/mongo.repository';

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

    if (pageSize > totalElements) {
      this.throwPaginationBadRequest(
        `Invalid pageSize=${pageSize}. pageSize cannot be greater than total properties (${totalElements}).`
      );
    }

    const data = pageSize === 0
      ? []
      : await this.mongoRepository.findAllPropertiesPaginated(page, pageSize);
    const normalizedData = data.map((item) => this.normalizePropertyTitle(item));

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

  private normalizePropertyTitle(item: unknown): unknown {
    if (typeof item !== 'object' || item === null) {
      return item;
    }

    const candidate = item as { title?: unknown };
    if (typeof candidate.title !== 'string') {
      return item;
    }

    const prefix = 'Alquiler de piso en ';
    if (!candidate.title.startsWith(prefix)) {
      return item;
    }

    return {
      ...(item as Record<string, unknown>),
      title: candidate.title.slice(prefix.length)
    };
  }
}
