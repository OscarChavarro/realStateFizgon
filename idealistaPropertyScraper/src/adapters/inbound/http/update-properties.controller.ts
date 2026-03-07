import { Controller, Post, UseGuards } from '@nestjs/common';
import { EndpointsBasicAuthGuard } from 'src/adapters/inbound/http/endpoints-basic-auth.guard';
import { ScraperState } from 'src/domain/states/scraper-state.enum';
import { ScraperStateMachineService } from 'src/application/services/state/scraper-state-machine.service';

@Controller()
@UseGuards(EndpointsBasicAuthGuard)
export class UpdatePropertiesController {
  constructor(private readonly scraperStateMachineService: ScraperStateMachineService) {}

  @Post('updateProperties')
  requestUpdateProperties(): { status: string; state: ScraperState; pendingRequests: number } {
    const pendingRequests = this.scraperStateMachineService.enqueueUpdatePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }

  @Post('scrapeProperties')
  requestScrapeProperties(): { status: string; state: ScraperState; pendingRequests: number } {
    const pendingRequests = this.scraperStateMachineService.enqueueScrapePropertiesRequest();
    return {
      status: 'queued',
      state: this.scraperStateMachineService.getCurrentState(),
      pendingRequests
    };
  }
}
