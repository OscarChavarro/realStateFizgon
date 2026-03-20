import { Inject, Injectable, Logger } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { PropertyDetailPageService } from 'src/application/services/scraper/property/property-detail-page.service';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class RevalidateExistingPropertyUrlsUseCase {
  private readonly logger = new Logger(RevalidateExistingPropertyUrlsUseCase.name);

  constructor(
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly propertyDetailPageService: PropertyDetailPageService
  ) {}

  async execute(client: CdpClient, urls: string[], processedUrls: Set<string>): Promise<void> {
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
