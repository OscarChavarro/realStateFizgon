import { Injectable } from '@nestjs/common';
import { ApplySearchFiltersUseCase } from 'application/usecases/scraper/apply-search-filters.use-case';

import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
@Injectable()
export class FiltersService {
  constructor(private readonly applySearchFiltersUseCase: ApplySearchFiltersUseCase) {}

  async execute(client: FiltersCdpClient): Promise<void> {
    await this.applySearchFiltersUseCase.execute(client);
  }
}

