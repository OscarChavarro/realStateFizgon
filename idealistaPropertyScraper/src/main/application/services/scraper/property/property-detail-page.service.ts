import { Injectable } from '@nestjs/common';
import { LoadPropertyDetailFromResultsUseCase } from 'src/application/usecases/scraper/load-property-detail-from-results.use-case';
import { ProcessLoadedPropertyDetailUseCase } from 'src/application/usecases/scraper/process-loaded-property-detail.use-case';
import { RevalidatePropertyDetailFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-property-detail-from-database.use-case';

import type { PropertyCdpClient } from 'src/ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class PropertyDetailPageService {
  constructor(
    private readonly loadPropertyDetailFromResultsUseCase: LoadPropertyDetailFromResultsUseCase,
    private readonly revalidatePropertyDetailFromDatabaseUseCase: RevalidatePropertyDetailFromDatabaseUseCase,
    private readonly processLoadedPropertyDetailUseCase: ProcessLoadedPropertyDetailUseCase
  ) {}

  async loadPropertyUrl(client: PropertyCdpClient, url: string): Promise<void> {
    await this.loadPropertyDetailFromResultsUseCase.execute(client, url, async () => {
      await this.processLoadedPropertyDetailUseCase.execute(client, url, 'ALWAYS');
    });
  }

  async loadPropertyUrlFromDatabase(client: PropertyCdpClient, url: string): Promise<void> {
    await this.revalidatePropertyDetailFromDatabaseUseCase.execute(client, url, async () => {
      await this.processLoadedPropertyDetailUseCase.execute(client, url, 'ONLY_WHEN_MISSING_IN_DB');
    });
  }
}
