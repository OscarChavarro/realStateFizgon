import { Injectable } from '@nestjs/common';
import { CdpClient } from 'src/application/services/scraper/filters/cdp-client.type';
import { PrepareSearchResultsUseCase } from 'src/application/usecases/prepare-search-results.use-case';

type RuntimeDomain = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{ result?: { value?: unknown } }>;
};

type PageDomain = {
  navigate(params: { url: string }): Promise<void>;
  reload(params?: { ignoreCache?: boolean }): Promise<void>;
  loadEventFired(cb: () => void): void;
};

@Injectable()
export class SearchResultsPreparationService {
  constructor(private readonly prepareSearchResultsUseCase: PrepareSearchResultsUseCase) {}

  async prepareSearchResultsWithFilters(client: CdpClient, page: PageDomain, runtime: RuntimeDomain): Promise<void> {
    await this.prepareSearchResultsUseCase.execute(client, page, runtime);
  }
}

