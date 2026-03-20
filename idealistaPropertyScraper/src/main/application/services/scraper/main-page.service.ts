import { Injectable } from '@nestjs/common';
import { ExecuteMainSearchFormUseCase } from 'application/usecases/scraper/execute-main-search-form.use-case';

import type { FiltersCdpClient } from 'ports/outbound/browser/filters-cdp-client.port';
@Injectable()
export class MainPageService {
  constructor(private readonly executeMainSearchFormUseCase: ExecuteMainSearchFormUseCase) {}

  async execute(client: FiltersCdpClient, mainSearchArea: string, scraperHomeUrl: string): Promise<void> {
    await this.executeMainSearchFormUseCase.execute(client, mainSearchArea, scraperHomeUrl);
  }
}

