import { ScraperState } from 'domain/states/scraper-state.enum';

export type RequestPropertiesCommandResult = {
  status: string;
  state: ScraperState;
  pendingRequests: number;
};
