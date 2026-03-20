import { Injectable } from '@nestjs/common';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { ExecuteScrapeNewPropertiesFlowUseCase } from 'src/application/usecases/scraper/execute-scrape-new-properties-flow.use-case';

@Injectable()
export class ScrapeNewPropertiesFlowService {
  constructor(private readonly executeScrapeNewPropertiesFlowUseCase: ExecuteScrapeNewPropertiesFlowUseCase) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.executeScrapeNewPropertiesFlowUseCase.execute(client);
  }
}
