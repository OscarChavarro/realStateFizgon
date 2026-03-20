import { Injectable } from '@nestjs/common';
import { ApplySearchFiltersUseCase } from 'src/application/usecases/scraper/apply-search-filters.use-case';

import type { FiltersCdpClient } from 'src/ports/outbound/browser/filters-cdp-client.port';
@Injectable()
export class FiltersService {
  constructor(private readonly applySearchFiltersUseCase: ApplySearchFiltersUseCase) {}

  async execute(client: FiltersCdpClient): Promise<void> {
    await this.applySearchFiltersUseCase.execute(client);
  }
}

