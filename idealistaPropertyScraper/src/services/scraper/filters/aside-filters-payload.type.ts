import { AsideSection } from 'src/services/scraper/filters/aside-section.type';

export type AsideFiltersPayload = {
  found: boolean;
  sections: AsideSection[];
};
