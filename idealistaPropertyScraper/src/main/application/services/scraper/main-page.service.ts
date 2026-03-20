import { Injectable } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { ExecuteMainSearchFormUseCase } from 'src/application/usecases/scraper/execute-main-search-form.use-case';

@Injectable()
export class MainPageService {
  constructor(private readonly executeMainSearchFormUseCase: ExecuteMainSearchFormUseCase) {}

  async execute(client: CdpClient, mainSearchArea: string, scraperHomeUrl: string): Promise<void> {
    await this.executeMainSearchFormUseCase.execute(client, mainSearchArea, scraperHomeUrl);
  }
}

