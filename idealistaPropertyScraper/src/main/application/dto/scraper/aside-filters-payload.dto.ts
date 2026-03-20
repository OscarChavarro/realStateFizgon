import { AsideSection } from 'application/dto/scraper/aside-section.dto';

export type AsideFiltersPayload = {
  found: boolean;
  sections: AsideSection[];
};
