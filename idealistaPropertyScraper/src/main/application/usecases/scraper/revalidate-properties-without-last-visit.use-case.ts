import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { PROPERTY_READ_PORT } from 'ports/outbound/persistence/property-read.port.token';

import type { ScrapeRunContext } from 'application/context/scrape-run-context';
import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class RevalidatePropertiesWithoutLastVisitUseCase {
  private readonly logger = new Logger(RevalidatePropertiesWithoutLastVisitUseCase.name);

  constructor(
    @Inject(PROPERTY_READ_PORT)
    private readonly propertyReadPort: PropertyReadPort,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient, scrapeRunContext: ScrapeRunContext): Promise<void> {
    const openUrlsWithoutLastTimeVisited = await this.propertyReadPort.getOpenPropertyUrlsWithoutLastTimeVisited();
    if (openUrlsWithoutLastTimeVisited.length === 0) {
      return;
    }

    this.logger.log(
      `UPDATING_PROPERTIES: pre-pass for ${openUrlsWithoutLastTimeVisited.length} open properties without lastTimeVisited.`
    );
    await this.propertyListPageService.processExistingUrls(client, openUrlsWithoutLastTimeVisited, scrapeRunContext);
  }
}
