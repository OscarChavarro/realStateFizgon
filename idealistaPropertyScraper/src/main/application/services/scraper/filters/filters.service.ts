import { Injectable } from '@nestjs/common';
import { ApplySearchFiltersUseCase } from 'src/application/usecases/scraper/apply-search-filters.use-case';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';

@Injectable()
export class FiltersService {
  constructor(private readonly applySearchFiltersUseCase: ApplySearchFiltersUseCase) {}

  async execute(client: CdpClient): Promise<void> {
    await this.applySearchFiltersUseCase.execute(client);
  }
}

