import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

import type { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
@Injectable()
export class RevalidateOpenPropertiesFromDatabaseUseCase {
  private readonly logger = new Logger(RevalidateOpenPropertiesFromDatabaseUseCase.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    const openUrls = await this.propertyPersistencePort.getOpenPropertyUrls();
    this.logger.log(`UPDATING_PROPERTIES: revalidating ${openUrls.length} open properties from MongoDB.`);
    await this.propertyListPageService.processExistingUrls(client, openUrls);
  }
}
