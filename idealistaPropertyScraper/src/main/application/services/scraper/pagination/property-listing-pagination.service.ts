import { Injectable } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PaginateAndProcessListingsUseCase } from 'src/application/usecases/paginate-and-process-listings.use-case';

@Injectable()
export class PropertyListingPaginationService {
  constructor(private readonly paginateAndProcessListingsUseCase: PaginateAndProcessListingsUseCase) {}

  async execute(client: CdpClient): Promise<void> {
    await this.paginateAndProcessListingsUseCase.execute(client);
  }
}

