import { Injectable } from '@nestjs/common';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'application/usecases/scraper/execute-scrape-new-properties-flow.use-case';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class ScrapeNewPropertiesFlowService {
  constructor(private readonly executeScrapeNewPropertiesFlowUseCase: ExecuteScrapeNewPropertiesFlowUseCase) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.executeScrapeNewPropertiesFlowUseCase.execute(client);
  }
}
