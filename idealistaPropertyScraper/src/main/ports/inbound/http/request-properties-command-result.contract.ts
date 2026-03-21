import { ScraperState } from 'domain/states/scraper-state';

export type RequestPropertiesCommandResult = {
  status: string;
  state: ScraperState;
  pendingRequests: number;
};
