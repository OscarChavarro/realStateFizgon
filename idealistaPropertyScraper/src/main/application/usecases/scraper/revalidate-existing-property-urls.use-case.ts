import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyDetailPageService } from 'application/services/scraper/property/property-detail-page.service';
import { PropertyPersistencePort } from 'ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'ports/outbound/persistence/property-persistence.port.token';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class RevalidateExistingPropertyUrlsUseCase {
  private readonly logger = new Logger(RevalidateExistingPropertyUrlsUseCase.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly propertyDetailPageService: PropertyDetailPageService
  ) {}

  async execute(client: PropertyCdpClient, urls: string[], processedUrls: Set<string>): Promise<void> {
    for (const url of urls) {
      if (processedUrls.has(url)) {
        this.logger.log(`URL already processed in current search cycle, skipping update: ${url}`);
        continue;
      }

      this.logger.log(`Revalidating existing property: ${url}`);
      await this.propertyDetailPageService.loadPropertyUrlFromDatabase(client, url);
      await this.propertyPersistencePort.touchPropertyLastTimeVisited(url);
      processedUrls.add(url);
    }
  }
}
