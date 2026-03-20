import { Injectable } from '@nestjs/common';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-scrape-new-properties-flow.use-case';

import type { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
@Injectable()
export class ScrapeNewPropertiesFlowService {
  constructor(private readonly executeScrapeNewPropertiesFlowUseCase: ExecuteScrapeNewPropertiesFlowUseCase) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.executeScrapeNewPropertiesFlowUseCase.execute(client);
  }
}
