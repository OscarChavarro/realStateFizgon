import { Injectable, Logger } from '@nestjs/common';
import { MongoDatabaseService } from '../../mongodb/mongo-database.service';
import { PropertyDetailPageService } from './property-detail-page.service';

type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

type CdpClient = {
  Page: {
    bringToFront(): Promise<void>;
  };
  Runtime: {
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
};

@Injectable()
export class PropertyListPageService {
  private readonly logger = new Logger(PropertyListPageService.name);
  private readonly processedUrlsSinceLastSearch = new Set<string>();

  constructor(
    private readonly mongoDatabaseService: MongoDatabaseService,
    private readonly propertyDetailPageService: PropertyDetailPageService
  ) {}

  async getPropertyUrls(client: CdpClient): Promise<string[]> {
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

  async processUrls(client: CdpClient, urls: string[]): Promise<void> {
    for (const url of urls) {
      if (this.processedUrlsSinceLastSearch.has(url)) {
        this.logger.log(`URL already processed in current search cycle, skipping click: ${url}`);
        continue;
      }

      const exists = await this.mongoDatabaseService.propertyExistsByUrl(url);
      if (exists) {
        this.logger.log(`URL already exists in MongoDB, skipping processing: ${url}`);
        continue;
      }

      this.logger.log(`URL should be processed (not found in MongoDB): ${url}`);
      await this.propertyDetailPageService.loadPropertyUrl(client, url);
      this.processedUrlsSinceLastSearch.add(url);
    }
  }
}
