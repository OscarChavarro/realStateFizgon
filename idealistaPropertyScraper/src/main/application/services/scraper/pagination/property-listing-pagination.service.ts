import { Injectable } from '@nestjs/common';
import { PaginateAndProcessListingsUseCase } from 'application/usecases/scraper/paginate-and-process-listings.use-case';

import type { ScrapeRunContext } from 'application/context/scrape-run-context';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class PropertyListingPaginationService {
  constructor(private readonly paginateAndProcessListingsUseCase: PaginateAndProcessListingsUseCase) {}

  async execute(client: PropertyCdpClient, scrapeRunContext: ScrapeRunContext): Promise<void> {
    await this.paginateAndProcessListingsUseCase.execute(client, scrapeRunContext);
  }
}
