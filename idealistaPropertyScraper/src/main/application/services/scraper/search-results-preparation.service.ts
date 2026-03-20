import { Injectable } from '@nestjs/common';
import { PrepareSearchResultsUseCase } from 'src/application/usecases/scraper/prepare-search-results.use-case';

import type { FiltersCdpClient } from 'src/ports/outbound/browser/filters-cdp-client.port';
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

  async prepareSearchResultsWithFilters(client: FiltersCdpClient, page: PageDomain, runtime: RuntimeDomain): Promise<void> {
    await this.prepareSearchResultsUseCase.execute(client, page, runtime);
  }
}

