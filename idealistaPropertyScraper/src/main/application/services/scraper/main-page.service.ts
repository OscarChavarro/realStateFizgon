import { Injectable } from '@nestjs/common';
import { ExecuteMainSearchFormUseCase } from 'src/application/usecases/scraper/execute-main-search-form.use-case';

import type { FiltersCdpClient } from 'src/ports/outbound/browser/filters-cdp-client.port';
@Injectable()
export class MainPageService {
  constructor(private readonly executeMainSearchFormUseCase: ExecuteMainSearchFormUseCase) {}

  async execute(client: FiltersCdpClient, mainSearchArea: string, scraperHomeUrl: string): Promise<void> {
    await this.executeMainSearchFormUseCase.execute(client, mainSearchArea, scraperHomeUrl);
  }
}

