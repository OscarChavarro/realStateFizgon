import { Injectable } from '@nestjs/common';
import { ProcessDiscoveredPropertyUrlsUseCase } from 'application/usecases/scraper/process-discovered-property-urls.use-case';
import { RevalidateExistingPropertyUrlsUseCase } from 'application/usecases/scraper/revalidate-existing-property-urls.use-case';
import { PropertyUrl } from 'domain/property/property-url';

import type { ScrapeRunContext } from 'application/context/scrape-run-context';
import type { PropertyCdpClient } from 'ports/outbound/browser/property-cdp-client.port';
@Injectable()
export class PropertyListPageService {
  constructor(
    private readonly processDiscoveredPropertyUrlsUseCase: ProcessDiscoveredPropertyUrlsUseCase,
    private readonly revalidateExistingPropertyUrlsUseCase: RevalidateExistingPropertyUrlsUseCase
  ) {}

  async getPropertyUrls(client: PropertyCdpClient): Promise<string[]> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const propertyPathRegex = new RegExp(${JSON.stringify(PropertyUrl.INMUEBLE_PATH_REGEX_SOURCE)}, 'i');
        const anchors = Array.from(
          document.querySelectorAll('article.item a.item-link[href], article.item a[href*="/inmueble/"]')
        );

        const urls = anchors
          .map((anchor) => {
            const href = (anchor instanceof HTMLAnchorElement ? anchor.href : anchor.getAttribute('href')) || '';
            if (!href || typeof href !== 'string') {
              return null;
            }

            try {
              const parsed = new URL(href, window.location.origin);
              if (!propertyPathRegex.test(parsed.pathname)) {
                return null;
              }

              return parsed.href;
            } catch {
              return null;
            }
          })
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

    const normalizedPropertyUrls = new Set<string>();
    for (const item of value) {
      if (typeof item !== 'string') {
        continue;
      }

      const normalized = PropertyUrl.normalize(item);
      if (normalized) {
        normalizedPropertyUrls.add(normalized);
      }
    }

    return Array.from(normalizedPropertyUrls);
  }

  async processUrls(client: PropertyCdpClient, urls: string[], scrapeRunContext: ScrapeRunContext): Promise<void> {
    await this.processDiscoveredPropertyUrlsUseCase.execute(client, urls, scrapeRunContext);
  }

  async processExistingUrls(
    client: PropertyCdpClient,
    urls: string[],
    scrapeRunContext: ScrapeRunContext
  ): Promise<void> {
    await this.revalidateExistingPropertyUrlsUseCase.execute(
      client,
      urls,
      scrapeRunContext
    );
  }
}
