import { Injectable } from '@nestjs/common';
import { PaginateAndProcessListingsUseCase } from 'src/application/usecases/scraper/paginate-and-process-listings.use-case';

import type { PropertyCdpClient } from 'src/application/services/scraper/property/cdp-client.type';
@Injectable()
export class PropertyListingPaginationService {
  constructor(private readonly paginateAndProcessListingsUseCase: PaginateAndProcessListingsUseCase) {}

  async execute(client: PropertyCdpClient): Promise<void> {
    await this.paginateAndProcessListingsUseCase.execute(client);
  }
}

