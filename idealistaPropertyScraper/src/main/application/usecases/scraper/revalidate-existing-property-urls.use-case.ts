import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { PROPERTY_WRITE_PORT } from 'ports/outbound/persistence/property-write.port.token';

import type { ScrapeRunContext } from 'application/context/scrape-run-context';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class RevalidateExistingPropertyUrlsUseCase {
  private readonly logger = new Logger(RevalidateExistingPropertyUrlsUseCase.name);

  constructor(
    @Inject(PROPERTY_WRITE_PORT)
    private readonly propertyWritePort: PropertyWritePort,
    private readonly propertyDetailPageService: PropertyDetailPageService
  ) {}

  async execute(client: PropertyCdpClient, urls: string[], scrapeRunContext: ScrapeRunContext): Promise<void> {
    const processedUrls = scrapeRunContext.processedPropertyUrls;
    for (const url of urls) {
      if (processedUrls.has(url)) {
        this.logger.log(`URL already processed in current search cycle, skipping update: ${url}`);
        continue;
      }

      this.logger.log(`Revalidating existing property: ${url}`);
      await this.propertyDetailPageService.loadPropertyUrlFromDatabase(client, url, scrapeRunContext);
      await this.propertyWritePort.touchPropertyLastTimeVisited(url);
      processedUrls.add(url);
    }
  }
}
