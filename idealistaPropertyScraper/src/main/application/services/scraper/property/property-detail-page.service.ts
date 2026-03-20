import { Injectable } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/property/cdp-client.type';
import { LoadPropertyDetailFromResultsUseCase } from 'src/application/usecases/scraper/load-property-detail-from-results.use-case';
import { ProcessLoadedPropertyDetailUseCase } from 'src/application/usecases/scraper/process-loaded-property-detail.use-case';
import { RevalidatePropertyDetailFromDatabaseUseCase } from 'src/application/usecases/scraper/revalidate-property-detail-from-database.use-case';

@Injectable()
export class PropertyDetailPageService {
  constructor(
    private readonly loadPropertyDetailFromResultsUseCase: LoadPropertyDetailFromResultsUseCase,
    private readonly revalidatePropertyDetailFromDatabaseUseCase: RevalidatePropertyDetailFromDatabaseUseCase,
    private readonly processLoadedPropertyDetailUseCase: ProcessLoadedPropertyDetailUseCase
  ) {}

  async loadPropertyUrl(client: CdpClient, url: string): Promise<void> {
    await this.loadPropertyDetailFromResultsUseCase.execute(client, url, async () => {
      await this.processLoadedPropertyDetailUseCase.execute(client, url, 'ALWAYS');
    });
  }

  async loadPropertyUrlFromDatabase(client: CdpClient, url: string): Promise<void> {
    await this.revalidatePropertyDetailFromDatabaseUseCase.execute(client, url, async () => {
      await this.processLoadedPropertyDetailUseCase.execute(client, url, 'ONLY_WHEN_MISSING_IN_DB');
    });
  }
}
