import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { PROPERTY_READ_PORT } from 'ports/outbound/persistence/property-read.port.token';
import { PropertyWritePort } from 'ports/outbound/persistence/property-write.port';
import { PROPERTY_WRITE_PORT } from 'ports/outbound/persistence/property-write.port.token';

import type { ScrapeRunContext } from 'application/context/scrape-run-context';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class ProcessDiscoveredPropertyUrlsUseCase {
  private readonly logger = new Logger(ProcessDiscoveredPropertyUrlsUseCase.name);

  constructor(
    @Inject(PROPERTY_READ_PORT)
    private readonly propertyReadPort: PropertyReadPort,
    @Inject(PROPERTY_WRITE_PORT)
    private readonly propertyWritePort: PropertyWritePort,
    private readonly propertyDetailPageService: PropertyDetailPageService
  ) {}

  async execute(client: PropertyCdpClient, urls: string[], scrapeRunContext: ScrapeRunContext): Promise<void> {
    const processedUrls = scrapeRunContext.processedPropertyUrls;
    for (const url of urls) {
      if (processedUrls.has(url)) {
        this.logger.log(`URL already processed in current search cycle, skipping click: ${url}`);
        continue;
      }

      const isOpen = await this.propertyReadPort.isOpenPropertyByUrl(url);
      if (isOpen) {
        this.logger.log(`Skipping existing open property: ${url}`);
        await this.propertyWritePort.touchPropertyLastTimeVisited(url);
        continue;
      }

      this.logger.log(`Processing new: ${url}`);
      await this.propertyDetailPageService.loadPropertyUrl(client, url, scrapeRunContext);
      processedUrls.add(url);
    }
  }
}
