import { Injectable } from '@nestjs/common';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import { ScraperState } from 'domain/states/scraper-state.enum';

type RequestScrapePropertiesResult = {
  status: string;
  state: ScraperState;
  pendingRequests: number;
};

@Injectable()
export class RequestScrapePropertiesUseCase {
  constructor(private readonly scraperStateMachineService: ScraperStateMachineService) {}

  execute(): RequestScrapePropertiesResult {
    const pendingRequests = this.scraperStateMachineService.enqueueScrapePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }
}
