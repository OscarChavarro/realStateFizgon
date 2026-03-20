import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyListPageService } from 'application/services/scraper/property/property-list-page.service';
import { PropertyPersistencePort } from 'ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'ports/outbound/persistence/property-persistence.port.token';

import type { ScraperCdpClient } from 'ports/outbound/browser/scraper-cdp-client.port';
@Injectable()
export class RevalidatePropertiesWithoutLastVisitUseCase {
  private readonly logger = new Logger(RevalidatePropertiesWithoutLastVisitUseCase.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    const openUrlsWithoutLastTimeVisited = await this.propertyPersistencePort.getOpenPropertyUrlsWithoutLastTimeVisited();
    if (openUrlsWithoutLastTimeVisited.length === 0) {
      return;
    }

    this.logger.log(
      `UPDATING_PROPERTIES: pre-pass for ${openUrlsWithoutLastTimeVisited.length} open properties without lastTimeVisited.`
    );
    await this.propertyListPageService.processExistingUrls(client, openUrlsWithoutLastTimeVisited);
  }
}
