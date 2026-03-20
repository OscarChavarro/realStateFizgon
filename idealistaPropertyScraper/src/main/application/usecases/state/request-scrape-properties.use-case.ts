import { Injectable } from '@nestjs/common';
import { ScraperStateMachineService } from 'application/services/state/scraper-state-machine.service';
import type { RequestPropertiesCommandResult } from 'ports/inbound/http/request-properties-command-result.contract';
import type { RequestScrapePropertiesPort } from 'ports/inbound/http/request-scrape-properties.port';

@Injectable()
export class RequestScrapePropertiesUseCase implements RequestScrapePropertiesPort {
  constructor(private readonly scraperStateMachineService: ScraperStateMachineService) {}

  execute(): RequestPropertiesCommandResult {
    const pendingRequests = this.scraperStateMachineService.enqueueScrapePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }
}
