import { Injectable, Logger } from '@nestjs/common';
import { Filter } from './filters/filter.interface';
import { SUPPORTED_FILTERS } from './filters/supported-filters';

type RuntimeEvaluateResult = {
  exceptionDetails?: {
    text?: string;
  };
  result?: {
    value?: unknown;
  };
};

type CdpClient = {
  Runtime: {
    enable(): Promise<void>;
    evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<RuntimeEvaluateResult>;
  };
};

type AsideSection = {
  index: number;
  name: string;
  normalized: string;
};

type AsideFiltersPayload = {
  found: boolean;
  sections: AsideSection[];
};

@Injectable()
export class FiltersService {
  private readonly logger = new Logger(FiltersService.name);

  private readonly supportedFilters: Filter[] = SUPPORTED_FILTERS;

  async execute(client: CdpClient): Promise<void> {
    await client.Runtime.enable();
    const payload = await this.readAsideFilters(client);

    if (!payload.found) {
      this.logger.warn('Filters root #aside-filters was not found on the page.');
      return;
    }

    const matchedSectionIndexes = new Set<number>();

    for (const supported of this.supportedFilters) {
      const presentBySelector = await this.isPresentBySelector(client, supported.getCssSelector());
      const supportedNormalized = this.normalizeText(supported.getName());
      const matched = payload.sections.find((section) => this.matches(section.normalized, supportedNormalized));
      if (matched) {
        matchedSectionIndexes.add(matched.index);
      }
      const present = presentBySelector || Boolean(matched);
      this.logger.log(`Filter: ${supported.getName()} | Present: ${present ? 'yes' : 'no'}`);
    }

    const unsupported = payload.sections.filter((section) => !matchedSectionIndexes.has(section.index));
    for (const section of unsupported) {
      this.logger.log(`Not supported: ${section.name}`);
    }
  }

  private async readAsideFilters(client: CdpClient): Promise<AsideFiltersPayload> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => value
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .toLowerCase()
          .replace(/\\s+/g, ' ')
          .trim();

        const getName = (element) => {
          const heading = element.matches('legend, h1, h2, h3, h4')
            ? element
            : element.querySelector(':scope > legend, :scope > .title-label, :scope > span.title-label, legend, .title-label, h1, h2, h3, h4');
          const source = heading || element;
          const text = (source.textContent || '').replace(/\\s+/g, ' ').trim();
          return text.length > 140 ? text.slice(0, 140) : text;
        };

        const root = document.querySelector('#aside-filters');
        if (!root) {
          return { found: false, sections: [] };
        }

        const formRoot = root.querySelector(':scope > #filter-form') || root.querySelector('#filter-form');
        const container = formRoot || root;

        const sections = Array.from(container.children)
          .map((child, index) => {
            const element = child;
            const hasHeading = Boolean(
              element.matches('fieldset.item-form, div.item-form') ||
              element.querySelector(':scope > legend, :scope > .title-label, :scope > span.title-label')
            );
            if (!hasHeading) {
              return null;
            }
            const name = getName(child);
            return {
              index,
              name,
              normalized: normalize(name)
            };
          })
          .filter((section) => section !== null)
          .filter((section) => section.name.length > 0);

        return {
          found: true,
          sections
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    const payload = result.result?.value as AsideFiltersPayload | undefined;
    if (!payload) {
      return { found: false, sections: [] };
    }

    return payload;
  }

  private matches(sectionName: string, supportedName: string): boolean {
    return sectionName.includes(supportedName) || supportedName.includes(sectionName);
  }

  private async isPresentBySelector(client: CdpClient, selector: string): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      returnByValue: true
    });

    return result.result?.value === true;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

}
