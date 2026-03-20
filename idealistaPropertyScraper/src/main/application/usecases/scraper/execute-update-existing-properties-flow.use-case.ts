import { Inject, Injectable, Logger } from '@nestjs/common';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { RevalidatePropertiesWithoutLastVisitUseCase } from 'src/application/usecases/scraper/revalidate-properties-without-last-visit.use-case';
import { PropertyPersistencePort } from 'src/ports/outbound/persistence/property-persistence.port';
import { PROPERTY_PERSISTENCE_PORT } from 'src/ports/outbound/persistence/property-persistence.port.token';

@Injectable()
export class ExecuteUpdateExistingPropertiesFlowUseCase {
  private readonly logger = new Logger(ExecuteUpdateExistingPropertiesFlowUseCase.name);

  constructor(
    private readonly searchResultsPreparationService: SearchResultsPreparationService,
    @Inject(PROPERTY_PERSISTENCE_PORT)
    private readonly propertyPersistencePort: PropertyPersistencePort,
    private readonly revalidatePropertiesWithoutLastVisitUseCase: RevalidatePropertiesWithoutLastVisitUseCase,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.searchResultsPreparationService.prepareSearchResultsWithFilters(
      client,
      client.Page,
      client.Runtime
    );

    this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
    await this.revalidatePropertiesWithoutLastVisitUseCase.execute(client);

    const openUrls = await this.propertyPersistencePort.getOpenPropertyUrls();
    this.logger.log(`UPDATING_PROPERTIES: revalidating ${openUrls.length} open properties from MongoDB.`);
    await this.propertyListPageService.processExistingUrls(client, openUrls);
    this.logger.log('UPDATING_PROPERTIES cycle finished.');
  }
}
