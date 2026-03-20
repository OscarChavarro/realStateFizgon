import { Inject, Injectable, Logger } from '@nestjs/common';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

import type { PropertyCdpClient } from 'src/application/services/scraper/property/cdp-client.type';
@Injectable()
export class ProcessDiscoveredPropertyUrlsUseCase {
  private readonly logger = new Logger(ProcessDiscoveredPropertyUrlsUseCase.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly propertyDetailPageService: PropertyDetailPageService
  ) {}

  async execute(client: PropertyCdpClient, urls: string[], processedUrls: Set<string>): Promise<void> {
    for (const url of urls) {
      if (processedUrls.has(url)) {
        this.logger.log(`URL already processed in current search cycle, skipping click: ${url}`);
        continue;
      }

      const isOpen = await this.propertyPersistencePort.isOpenPropertyByUrl(url);
      if (isOpen) {
        this.logger.log(`Skipping existing open property: ${url}`);
        await this.propertyPersistencePort.touchPropertyLastTimeVisited(url);
        continue;
      }

      this.logger.log(`Processing new: ${url}`);
      await this.propertyDetailPageService.loadPropertyUrl(client, url);
      processedUrls.add(url);
    }
  }
}
