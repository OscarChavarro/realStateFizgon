import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { PropertyReadPort } from 'ports/outbound/persistence/property-read.port';
import { PROPERTY_READ_PORT } from 'ports/outbound/persistence/property-read.port.token';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class RevalidateOpenPropertiesFromDatabaseUseCase {
  private readonly logger = new Logger(RevalidateOpenPropertiesFromDatabaseUseCase.name);

  constructor(
    @Inject(PROPERTY_READ_PORT)
    private readonly propertyReadPort: PropertyReadPort,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    const openUrls = await this.propertyReadPort.getOpenPropertyUrls();
    this.logger.log(`UPDATING_PROPERTIES: revalidating ${openUrls.length} open properties from MongoDB.`);
    await this.propertyListPageService.processExistingUrls(client, openUrls);
  }
}
