import { Injectable, Logger } from '@nestjs/common';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'application/usecases/scraper/process-discovered-property-urls.use-case';
import { RevalidateExistingPropertyUrlsUseCase } from 'application/usecases/scraper/revalidate-existing-property-urls.use-case';

import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class PropertyListPageService {
  private readonly logger = new Logger(PropertyListPageService.name);
  private readonly processedUrlsSinceLastSearch = new Set<string>();

  constructor(
    private readonly processDiscoveredPropertyUrlsUseCase: ProcessDiscoveredPropertyUrlsUseCase,
    private readonly revalidateExistingPropertyUrlsUseCase: RevalidateExistingPropertyUrlsUseCase
  ) {}

  async getPropertyUrls(client: PropertyCdpClient): Promise<string[]> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalizeUrl = (value) => {
          if (!value || typeof value !== 'string') {
            return null;
          }
          const trimmed = value.trim();
          if (trimmed.length === 0) {
            return null;
          }

          let parsed;
          try {
            parsed = new URL(trimmed, window.location.origin);
          } catch {
            return null;
          }

          const match = parsed.pathname.match(/^\\/inmueble\\/(\\d+)\\/?/);
          if (!match) {
            return null;
          }

          return parsed.origin + '/inmueble/' + match[1] + '/';
        };

        const urls = Array.from(document.querySelectorAll('article.item a.item-link[href], article.item a[href*="/inmueble/"]'))
          .map((anchor) => normalizeUrl(anchor.getAttribute('href') || ''))
          .filter((url) => typeof url === 'string');

        return Array.from(new Set(urls));
      })()`,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    const value = result.result?.value;
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  resetProcessedUrlsForCurrentSearch(): void {
    this.processedUrlsSinceLastSearch.clear();
    this.logger.log('Reset processed property URL cache for the current search cycle.');
  }

  async processUrls(client: PropertyCdpClient, urls: string[]): Promise<void> {
    await this.processDiscoveredPropertyUrlsUseCase.execute(client, urls, this.processedUrlsSinceLastSearch);
  }

  async processExistingUrls(client: PropertyCdpClient, urls: string[]): Promise<void> {
    await this.revalidateExistingPropertyUrlsUseCase.execute(
      client,
      urls,
      this.processedUrlsSinceLastSearch
    );
  }
}
