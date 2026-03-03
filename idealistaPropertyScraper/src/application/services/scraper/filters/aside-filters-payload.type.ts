import { AsideSection } from 'src/application/services/scraper/filters/aside-section.type';

export type AsideFiltersPayload = {
  found: boolean;
  sections: AsideSection[];
};
