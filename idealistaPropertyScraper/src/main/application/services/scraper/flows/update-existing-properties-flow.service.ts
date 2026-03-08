import { Injectable, Logger } from '@nestjs/common';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { PropertyListPageService } from 'src/application/services/scraper/property/property-list-page.service';
import { SearchResultsPreparationService } from 'src/application/services/scraper/search-results-preparation.service';
import { ScraperCdpClient } from 'src/application/services/chromium/scraper-cdp-client.type';

@Injectable()
export class UpdateExistingPropertiesFlowService {
  private readonly logger = new Logger(UpdateExistingPropertiesFlowService.name);

  constructor(
    private readonly searchResultsPreparationService: SearchResultsPreparationService,
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly propertyListPageService: PropertyListPageService
  ) {}

  async execute(client: ScraperCdpClient): Promise<void> {
    await this.searchResultsPreparationService.prepareSearchResultsWithFilters(
      client,
      client.Page,
      client.Runtime
    );

    this.propertyListPageService.resetProcessedUrlsForCurrentSearch();
    const openUrlsWithoutLastTimeVisited = await this.mongoDatabaseService.getOpenPropertyUrlsWithoutLastTimeVisited();
    if (openUrlsWithoutLastTimeVisited.length > 0) {
      this.logger.log(
        `UPDATING_PROPERTIES: pre-pass for ${openUrlsWithoutLastTimeVisited.length} open properties without lastTimeVisited.`
      );
      await this.propertyListPageService.processExistingUrls(client, openUrlsWithoutLastTimeVisited);
    }

    const openUrls = await this.mongoDatabaseService.getOpenPropertyUrls();
    this.logger.log(`UPDATING_PROPERTIES: revalidating ${openUrls.length} open properties from MongoDB.`);
    await this.propertyListPageService.processExistingUrls(client, openUrls);
    this.logger.log('UPDATING_PROPERTIES cycle finished.');
  }
}
